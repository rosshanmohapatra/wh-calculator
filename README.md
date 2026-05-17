# 5pm — Work Hour Tracker

> **Leave on time, every time.**

5pm is a personal work-hour tracker that tells you exactly when to leave each day. It tracks login time in real time, computes remaining hours against a daily/weekly target, and surfaces a live "leave at" recommendation — so you work your hours honestly and not a minute more.

---

## Product Overview

### What It Does

- **Live shift tracking** — log in once, the clock runs. Pause/resume supported.
- **Daily + Weekly targets** — set 8 h/day or 40 h/week; the app distributes the deficit intelligently.
- **Recommended leave time** — a real-time "Leave at HH:MM" badge, updated every second.
- **Stay-hint system** — if you're behind on the week, the app tells you exactly how long to stay today to catch up (capped at +1 hr above daily target).
- **Day overrides** — mark any day as Half Day, Full Day Leave, or Holiday.
- **Week planning** — schedule early leave or late stay for future days.
- **Penalty calculation** — tracks days/weeks where you fell short and surfaces a makeup owed.
- **Early leave target** — set a personal out-time target per day (e.g. "I need to leave by 4 PM today").
- **Session editing** — edit login/logout retroactively with overlap prevention.
- **Auto-stop protection** — prevents runaway tracking past a configurable cap.
- **Notifications** — smart reminders when you hit target, when overtime kicks in, when a deficit builds.
- **Data import/export** — full JSON backup and restore.
- **Onboarding flow** — 5-step wizard: import, personal details, routine setup, week plan, done.
- **Light/dark mode** — system-aware, toggle button, no flash on load.

### Stack (Current — Pre-Supabase)

| Layer | Technology |
|-------|-----------|
| UI | Vanilla HTML/CSS/JS — single `index.html` |
| Auth UI | `login.html` — OAuth (Google, GitHub), email/password, OTP recovery |
| State | `localStorage` — all tracking data, config, auth flag |
| Auth gate | Inline `<head>` script — blocks render before `wh_auth` check |
| Hosting | Static file server (local dev: `http://localhost:3000`) |
| Repo | `feature/auth-ui` branch on GitHub |

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `wh_auth` | Auth flag — `'1'` if authenticated |
| `wh_theme` | `'dark'` or `'light'` |
| `wh_cfg` | JSON blob — all user config (target hours, work days, name, etc.) |
| `wh_ob_done` | Onboarding complete flag |
| `wh_day_YYYY-MM-DD` | Per-day log entries |
| `wh_ver` | App version — triggers data wipe on version bump |

### Config Shape (`wh_cfg`)

```json
{
  "name": "Alex",
  "dailyH": 9,
  "weeklyH": 45,
  "workDays": ["Mon","Tue","Wed","Thu","Fri"],
  "includeSat": false,
  "penaltyMode": "weekly",
  "earlyLeaveH": 0,
  "stayLateH": 0,
  "autostopH": 12
}
```

### Day Log Shape (`wh_day_YYYY-MM-DD`)

```json
{
  "loginTime": "09:05:23",
  "loginDisplay": "9:05 AM",
  "checkoutDisplay": "6:02 PM",
  "hoursWorked": 8.95,
  "override": null,
  "earlyLeaveTarget": "4:00 PM",
  "futurePlan": "halfday",
  "scheduled": true,
  "autostopped": false,
  "sessionTag": "normal",
  "lastUpdated": "2026-05-13T18:02:11.000Z"
}
```

---

## Supabase Migration Plan

The app is migrating from `localStorage` to Supabase. Supabase Auth replaces the current `wh_auth` flag. All data moves to Postgres with strict RLS. The client remains a static HTML/JS app — Supabase JS SDK replaces direct localStorage writes.

---

## Database Schema

### Design Rules (Non-Negotiable)

1. **RLS is ON for every table — no exceptions.**
2. Every policy uses `(SELECT auth.uid())` not `auth.uid()` — prevents per-row re-evaluation.
3. Every INSERT/UPDATE policy has a `WITH CHECK` clause — prevents row-ownership hijacking.
4. Sensitive server-managed fields (`is_admin`, `plan`, `credits`) live in a **separate table** not writable by `authenticated` role.
5. No `USING (true)` or `USING (auth.uid() IS NOT NULL)` — always scope to the owner row.
6. `SECURITY DEFINER` functions live in the `private` schema, never `public`.
7. `service_role` key **never** touches the client. Client uses `anon` key only.

---

### Migration SQL — Run in Order

```sql
-- ══════════════════════════════════════════════════
-- 0. SAFETY NET — enable RLS on every public table
--    Run after every migration to catch missed tables
-- ══════════════════════════════════════════════════
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════
-- 1. PROFILES
--    Public display data — safe for authenticated reads
--    Sensitive fields are NOT here
-- ══════════════════════════════════════════════════
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile only
CREATE POLICY "profiles: owner select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Users can insert their own profile on signup
CREATE POLICY "profiles: owner insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- Users can update only safe display fields (NOT id, created_at)
CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Revoke UPDATE on protected columns — users cannot touch these
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, updated_at) ON public.profiles TO authenticated;


-- ══════════════════════════════════════════════════
-- 2. ACCOUNT META (server-managed — never user-writable)
--    plan, admin flag, credits — protected from client writes
-- ══════════════════════════════════════════════════
CREATE TABLE public.account_meta (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','team')),
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  credits       INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_meta ENABLE ROW LEVEL SECURITY;

-- Users can only READ their own meta (plan, credits) — never write
CREATE POLICY "account_meta: owner select"
  ON public.account_meta FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- No INSERT/UPDATE/DELETE policies for authenticated role
-- Only service_role (server-side) can modify this table
REVOKE INSERT, UPDATE, DELETE ON public.account_meta FROM authenticated;


-- ══════════════════════════════════════════════════
-- 3. WORK CONFIGS
--    User preferences — dailyH, weeklyH, workDays, etc.
-- ══════════════════════════════════════════════════
CREATE TABLE public.work_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_h       NUMERIC(4,2) NOT NULL DEFAULT 9 CHECK (daily_h > 0 AND daily_h <= 24),
  weekly_h      NUMERIC(5,2) NOT NULL DEFAULT 45 CHECK (weekly_h > 0 AND weekly_h <= 168),
  work_days     TEXT[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  include_sat   BOOLEAN NOT NULL DEFAULT FALSE,
  penalty_mode  TEXT NOT NULL DEFAULT 'weekly' CHECK (penalty_mode IN ('daily','weekly')),
  early_leave_h NUMERIC(3,2) NOT NULL DEFAULT 0,
  stay_late_h   NUMERIC(3,2) NOT NULL DEFAULT 0,
  autostop_h    NUMERIC(4,2) NOT NULL DEFAULT 12,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.work_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_configs: owner select"
  ON public.work_configs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "work_configs: owner insert"
  ON public.work_configs FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "work_configs: owner update"
  ON public.work_configs FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "work_configs: owner delete"
  ON public.work_configs FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ══════════════════════════════════════════════════
-- 4. DAY LOGS
--    One row per user per calendar day
-- ══════════════════════════════════════════════════
CREATE TABLE public.day_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  login_time        TEXT,
  login_display     TEXT,
  checkout_display  TEXT,
  hours_worked      NUMERIC(5,4) CHECK (hours_worked >= 0 AND hours_worked <= 24),
  override          TEXT CHECK (override IN ('halfday','leave','holiday') OR override IS NULL),
  early_leave_target TEXT,
  future_plan       TEXT CHECK (future_plan IN ('halfday','leave','holiday') OR future_plan IS NULL),
  future_reason     TEXT,
  scheduled         BOOLEAN NOT NULL DEFAULT FALSE,
  autostopped       BOOLEAN NOT NULL DEFAULT FALSE,
  session_tag       TEXT,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.day_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_logs: owner select"
  ON public.day_logs FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "day_logs: owner insert"
  ON public.day_logs FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "day_logs: owner update"
  ON public.day_logs FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "day_logs: owner delete"
  ON public.day_logs FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ══════════════════════════════════════════════════
-- 5. WEEK PLANS
--    Per-user week overrides (optional future feature)
-- ══════════════════════════════════════════════════
CREATE TABLE public.week_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  plan_data   JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.week_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "week_plans: owner select"
  ON public.week_plans FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "week_plans: owner insert"
  ON public.week_plans FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "week_plans: owner update"
  ON public.week_plans FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "week_plans: owner delete"
  ON public.week_plans FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ══════════════════════════════════════════════════
-- 6. NOTIFICATIONS
--    System-generated alerts — user can read/dismiss only
-- ══════════════════════════════════════════════════
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('info','warning','success','penalty')),
  text        TEXT NOT NULL,
  action_label TEXT,
  dismissed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications: owner select"
  ON public.notifications FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Users can dismiss (update dismissed flag) — but NOT change type/text/user_id
CREATE POLICY "notifications: owner dismiss"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Only dismissal column is user-writable — all others locked server-side
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (dismissed) ON public.notifications TO authenticated;

-- Users CANNOT insert notifications — only service_role can
-- Users CAN delete their own dismissed notifications
CREATE POLICY "notifications: owner delete"
  ON public.notifications FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id AND dismissed = TRUE);

REVOKE INSERT ON public.notifications FROM authenticated;


-- ══════════════════════════════════════════════════
-- 7. AUDIT LOG (append-only — users cannot modify)
-- ══════════════════════════════════════════════════
CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  target_table TEXT,
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit trail
CREATE POLICY "audit_log: owner select"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Users CANNOT write to audit log — only service_role via server-side triggers
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;


-- ══════════════════════════════════════════════════
-- 8. FINAL SAFETY CHECK
--    Verify every table has RLS enabled
-- ══════════════════════════════════════════════════
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
```

---

## Automatic Profile Creation on Signup

When a user signs up via Supabase Auth, create their `profiles` and `account_meta` rows automatically using a trigger — never trust the client to create these.

```sql
-- Private schema function (SECURITY DEFINER — bypasses RLS to insert)
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.account_meta (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Fire on every new auth.users row
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();
```

---

## Environment Variables

```bash
# .env.local — NEVER commit this file
SUPABASE_URL=https://your-project.supabase.co

# Client-safe — anon key only, not service_role
SUPABASE_ANON_KEY=eyJhbGc...

# Server-side ONLY — Edge Functions, server actions, admin scripts
# NEVER prefix with NEXT_PUBLIC_ / VITE_ / EXPO_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Rule:** The `service_role` key bypasses every RLS policy. It must never reach the browser. If it ever appears in a client bundle — even once — rotate it immediately in the Supabase dashboard.

---

## Supabase Client Setup

```js
// lib/supabase.js — client-side (anon key only)
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
  // NO service_role key here — ever
)
```

---

## How to Prompt Claude to Build Secure Supabase Tables

Use this template when asking Claude (or any AI) to add a new table. Copy-paste it verbatim — it encodes all the rules above.

```
Create a Supabase table called `[table_name]` with these columns:
[list your columns]

Security requirements — follow all of these exactly:

1. Enable RLS: `ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;`
2. All policies must use `(SELECT auth.uid())` — not `auth.uid()` — to prevent per-row re-evaluation.
3. Every INSERT and UPDATE policy must have a `WITH CHECK ((SELECT auth.uid()) = user_id)` clause.
4. Never use `USING (true)` or `USING (auth.uid() IS NOT NULL)` — always scope to the owner row.
5. If any column should not be writable by the user (e.g. is_admin, plan, credits, server timestamps):
   - REVOKE UPDATE ON [table] FROM authenticated;
   - GRANT UPDATE (only_safe_column1, only_safe_column2) ON [table] TO authenticated;
6. If the table is append-only or system-generated (audit logs, notifications):
   - REVOKE INSERT, UPDATE, DELETE ON [table] FROM authenticated;
7. Create one policy per operation (SELECT, INSERT, UPDATE, DELETE) — not a combined policy.
8. Add CHECK constraints on all enum-like TEXT columns (e.g. CHECK (status IN ('a','b','c'))).
9. After writing all SQL, run the RLS safety net:
   DO $$ DECLARE r RECORD;
   BEGIN
     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
     LOOP
       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
     END LOOP;
   END $$;
10. Do NOT create any SECURITY DEFINER function in the public schema. Use the private schema.
```

---

## Security Checklist (Run Before Every Deploy)

- [ ] Every table in `public` schema has `rls_enabled = true` — verify in Supabase dashboard → Table Editor
- [ ] No policy uses `USING (true)` or `USING (auth.uid() IS NOT NULL)`
- [ ] Every UPDATE/INSERT policy has `WITH CHECK`
- [ ] `service_role` key is NOT in any client-side file or environment variable with a public prefix
- [ ] `.env` / `.env.local` is in `.gitignore` and NOT tracked by git (`git ls-files | grep .env`)
- [ ] `account_meta` table has no INSERT/UPDATE policies for `authenticated` role
- [ ] `audit_log` table has no INSERT/UPDATE/DELETE policies for `authenticated` role
- [ ] All `SECURITY DEFINER` functions are in `private` schema with `SET search_path = ''`
- [ ] Supabase Auth → Email confirmations enabled in production
- [ ] Supabase Auth → Disable "Allow new users to sign up" is OFF (or ON if invite-only)

---

## Current Security Posture (Pre-Supabase)

| Area | Status | Notes |
|------|--------|-------|
| Auth gate | ✅ Fixed | Inline `<head>` script blocks render before `wh_auth` check |
| Theme flash | ✅ Fixed | Inline `<head>` script applies theme before paint |
| Keyboard shortcuts | ✅ Fixed | `'d'` theme shortcut removed — button only |
| OAuth flash | ✅ Fixed | `showSuccess` now sets `display:flex` explicitly |
| `service_role` exposure | ✅ N/A | No backend yet — no keys in codebase |
| RLS | ⏳ Pending | Will be enforced in full on Supabase connection |
| `wh_auth` in localStorage | ⚠️ Interim | Acceptable for static prototype; replace with Supabase session cookie on migration |
| Input validation | ⚠️ Partial | Client-side only; full server-side validation needed post-migration |

---

## Repository

- **Branch:** `feature/auth-ui`
- **Remote:** `https://github.com/rosshanmohapatra/Murph-WH-Tracker`
- **Entry points:** `login.html` (auth) → `index.html` (app)
- **No build step** — deploy as static files
