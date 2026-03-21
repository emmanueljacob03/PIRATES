import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours – same code can be used by anyone

function getSecret(): string {
  return (process.env.PIRATES_SECURITY_CODE || 'Pirates102').trim();
}

export function createCodeToken(): string {
  const payload = { t: Date.now() };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
  return `${data}.${sig}`;
}

/** Validate token (no consume – reusable so anyone with the code can enter). */
export function validateCodeToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  try {
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
    if (expectedSig !== sig) return false;
    const raw = Buffer.from(data, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as { t?: number };
    const t = payload?.t;
    if (typeof t !== 'number') return false;
    return Date.now() - t <= TOKEN_TTL_MS;
  } catch {
    return false;
  }
}

/** @deprecated Use validateCodeToken for set-code-cookie so code works for everyone. */
export function consumeCodeToken(token: string): boolean {
  return validateCodeToken(token);
}
