/**
 * Email capture for award-season alerts, winner lists and deal drops.
 *
 * This is a root-level Vercel function, not a Next route handler: the site is
 * `output: 'export'`, so Next emits static HTML only. Vercel still builds
 * anything under /api into its own function (verified against
 * .vercel/output/functions), which keeps the pages static and gives us the one
 * endpoint the form needs.
 *
 * Writes go through the service role. The table has no anon insert policy, so
 * the key cannot move to the client.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body) return res.status(400).json({ error: 'Invalid request' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  const source = ['site', 'coming-soon'].includes(body.source) ? body.source : 'site';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[subscribe] Supabase env vars missing');
    return res.status(500).json({ error: 'Try again later' });
  }

  try {
    // ignore-duplicates so a repeat signup is a quiet success, not a 409.
    const r = await fetch(`${url}/rest/v1/email_subscribers?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ email, source }),
    });

    if (!r.ok) {
      console.error('[subscribe] insert failed:', r.status, (await r.text()).slice(0, 200));
      return res.status(500).json({ error: 'Try again later' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[subscribe] request failed:', err.message);
    return res.status(500).json({ error: 'Try again later' });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
