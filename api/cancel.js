// Cancellation is handled client-side via clearTimeout.
// This stub exists for future server-side scheduling (e.g. post-Supabase).
export default function handler(req, res) {
  res.status(200).json({ ok: true, cancelled: 0 });
}
