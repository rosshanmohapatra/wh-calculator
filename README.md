# WH Calculator

A single-file work-hours tracker that runs entirely in the browser — no server, no dependencies, no install.

**📱 Live Demo:** [whcalculator.vercel.app](https://whcalculator.vercel.app/)  
**Version:** v0.9.0

## Features

- **Daily tracking** — log in/out times with design-system time picker, live elapsed timer, early-leave targets
- **Weekly dashboard** — SVG progress rings with color-coded overrides, surplus/deficit tracking, date range view
- **Settings** — configurable shift times, dual H/M weekly target inputs, multi-select early-leave days
- **Overrides** — Half Day, Holiday, All Day Leave with toggle deselect in day editor
- **Import / Export** — structured JSON backup (`wh_backup_v2`) with full data portability
- **Smart defaults** — auto-apply shift timing when saving empty end time, optional out time for active sessions
- **Dark mode** — auto-detects system preference, toggle in the nav
- **Monitor-cloud favicon** — custom SVG icon

## Usage

Just open `index.html` in any modern browser. All data is stored in `localStorage`.

## Recent Updates (v0.9.0)

### UI/UX
- ✨ **Design-system time picker modal** — floating panel with H/M steppers, AM/PM toggle, positioned below input
- 🎨 **Extra Hours SVG rings** — pie-stroke circles with holiday/half-day/leave color accents
- 📅 **Date range format** — "May 4 to 8" instead of individual dates
- ⏱️ **Inline time editing** — click In/Out boxes to open picker (no separate clock icon)
- 🏷️ **Clearer labels** — "Logged In" / "Log Out" / "Leave Early" / "All Day Leave"
- ⏹️ **Session awareness** — "Not Started" vs "Elapsed" status label
- 🎯 **Override visual feedback** — centered badges for Missing Data, toggle-deselect buttons

### Features
- 📋 **Multi-select early-leave days** — pick multiple days per week instead of just one
- ⚙️ **Split weekly target** — separate H and M inputs for precision
- 🔄 **Smart save defaults** — apply shift defaults on empty end time, optional out time for active tracking
- 🧹 **Improved data management** — "Manage Data" (was "Log File"), "Last Updated at" timestamps

### Technical
- 🔐 **Structured JSON export** — `wh_backup_v2` schema with `earlyLeaveDays[]` array
- 🎨 **Design tokens** — CSS custom properties for theme consistency
- 📱 **Responsive design** — mobile-optimized layout with proper touch targets
