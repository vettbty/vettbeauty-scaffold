/**
 * Signed session cookie for the private status page.
 * Signs an expiry timestamp; the password itself is never stored or sent.
 */
const enc = new TextEncoder();
export const COOKIE = "vett_status";

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(value: string, secret: string) {
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(secret: string, days = 7) {
  const exp = Date.now() + days * 86_400_000;
  return `${exp}.${await sign(String(exp), secret)}`;
}

export async function verifySession(value: string | undefined, secret: string) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig) return false;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return false;
  return (await sign(exp, secret)) === sig;
}
