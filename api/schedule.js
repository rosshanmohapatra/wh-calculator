// Schedules up to 3 Web Push notifications via QStash (Upstash).
// Called when the user starts a shift.
import { Client } from '@upstash/qstash';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, loginTimestamp, dailyTargetSecs, notifPrefs } = req.body || {};

  if (!userId || !loginTimestamp || !dailyTargetSecs) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const c = new Client({ token: process.env.QSTASH_TOKEN });

  // Derive the app's public URL for the QStash callback
  const appUrl = process.env.APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!appUrl) return res.status(500).json({ error: 'APP_URL not configured' });

  const baseMs = new Date(loginTimestamp).getTime();
  const now    = Date.now();

  const jobs = [
    {
      enabled:     !!notifPrefs?.kickstart,
      type:        'kickstart',
      offsetSecs:  dailyTargetSecs - 300,   // 5 min before target
    },
    {
      enabled:     !!notifPrefs?.target,
      type:        'target',
      offsetSecs:  dailyTargetSecs,          // exactly at target
    },
    {
      enabled:     !!notifPrefs?.overtime,
      type:        'overtime',
      offsetSecs:  dailyTargetSecs + 300,   // 5 min after target
    },
  ];

  const messageIds = [];

  for (const job of jobs) {
    if (!job.enabled) continue;

    const fireMs    = baseMs + job.offsetSecs * 1000;
    const delaySecs = Math.floor((fireMs - now) / 1000);

    if (delaySecs < 10) continue; // already passed — skip

    try {
      const { messageId } = await c.publishJSON({
        url:   `${appUrl}/api/notify`,
        body:  {
          userId,
          type:    job.type,
          _secret: process.env.NOTIFY_SECRET, // shared secret to authenticate QStash callbacks
        },
        delay: delaySecs,
      });
      if (messageId) messageIds.push(messageId);
    } catch (err) {
      console.error(`QStash schedule failed for ${job.type}:`, err.message);
    }
  }

  res.status(200).json({ ok: true, messageIds });
}
