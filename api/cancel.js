// Cancels previously scheduled QStash messages (e.g. when user ends shift early).
import { Client } from '@upstash/qstash';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messageIds } = req.body || {};

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(200).json({ ok: true, cancelled: 0 });
  }

  const c = new Client({ token: process.env.QSTASH_TOKEN });
  let cancelled = 0;

  for (const id of messageIds) {
    try {
      await c.messages.delete(id);
      cancelled++;
    } catch (_) {
      // Message may have already fired — ignore
    }
  }

  res.status(200).json({ ok: true, cancelled });
}
