import crypto from 'crypto';

const TTL_MS = 3 * 60 * 1000; // 3 minutes — single-use navigation, short window

function secret(): string {
  return `${(process.env.PIRATES_TEAM_HANDOFF_SECRET || process.env.PIRATES_SECURITY_CODE || 'Pirates102').trim()}:handoff`;
}

type Payload = { v: 1; exp: number; adm: boolean };

export function createTeamCodeHandoffToken(isAdmin: boolean): string {
  const payload: Payload = { v: 1, exp: Date.now() + TTL_MS, adm: isAdmin };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('hex');
  return `${data}.${sig}`;
}

/** Returns admin flag if token is valid; otherwise null. */
export function parseTeamCodeHandoffToken(token: string | null | undefined): { isAdmin: boolean } | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  try {
    const expectedSig = crypto.createHmac('sha256', secret()).update(data).digest('hex');
    if (expectedSig !== sig) return null;
    const raw = Buffer.from(data, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as Payload;
    if (payload?.v !== 1 || typeof payload.exp !== 'number' || typeof payload.adm !== 'boolean') return null;
    if (Date.now() > payload.exp) return null;
    return { isAdmin: payload.adm };
  } catch {
    return null;
  }
}
