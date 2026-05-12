// Saves a Web Push subscription object to Vercel KV, keyed by userId.
// Called from the client after the user grants notification permission.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, subscription } = req.body || {};

  if (!userId || !subscription?.endpoint) {
    return res.status(400).json({ error: 'Missing userId or subscription' });
  }

  // Store for 1 year — refreshed on every permission grant
  await kv.set(
    `sub:${userId}`,
    JSON.stringify(subscription),
    { ex: 60 * 60 * 24 * 365 }
  );

  res.status(200).json({ ok: true });
}
