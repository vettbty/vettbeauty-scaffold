/**
 * One-click unsubscribe. Removing the row is the whole job — the table stores
 * nothing but the address, so deletion is a clean, complete opt-out with no
 * suppression list to leak later.
 *
 * Always reports success: confirming whether an address is on the list would
 * turn this into an address-enumeration oracle.
 *
 * Restored alongside subscribe. Sending mail without a working opt-out is not
 * an option, so this has to exist before RESEND_API_KEY is ever set.
 */
import { rateLimit } from './_ratelimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body) return res.status(400).json({ error: 'Invalid request' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[unsubscribe] Supabase env vars missing');
    return res.status(500).json({ error: 'Try again later' });
  }

  try {
    const r = await fetch(
      `${url}/rest/v1/email_subscribers?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      }
    );
    if (!r.ok) {
      console.error('[unsubscribe] delete failed:', r.status, (await r.text()).slice(0, 200));
      return res.status(500).json({ error: 'Try again later' });
    }
    // Deliberately identical whether or not a row existed.
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[unsubscribe] request failed:', err.message);
    return res.status(500).json({ error: 'Try again later' });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
