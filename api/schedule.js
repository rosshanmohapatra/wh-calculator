// Scheduling is handled client-side via setTimeout + SW showNotification.
// This stub exists for future server-side scheduling (e.g. post-Supabase).
export default function handler(req, res) {
  res.status(200).json({ ok: true, messageIds: [] });
}
