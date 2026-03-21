import { supabase } from '@/lib/supabase';

/**
 * Client-only: POST validates code, then full GET to /api/team-code-handoff (sets cookies + 303 dashboard).
 * Fetch Set-Cookie + immediate /dashboard was still losing cookies/session on the first RSC hop for some users.
 */
export async function submitTeamCodeAndGoDashboard(code: string): Promise<'ok' | 'invalid' | 'network'> {
  const trimmed = code.trim();
  if (!trimmed) return 'invalid';
  try {
    // Persist session to httpOnly cookies (critical after achievements → soft login; first dashboard load needs server session).
    await supabase.auth.refreshSession().catch(() => {});
    await supabase.auth.getSession();
    const res = await fetch('/api/set-code-cookie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ code: trimmed }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; handoff?: string };
    if (!res.ok || !data.ok || typeof data.handoff !== 'string' || !data.handoff) return 'invalid';
    if (typeof window !== 'undefined') {
      window.location.assign(`/api/team-code-handoff?t=${encodeURIComponent(data.handoff)}`);
    }
    return 'ok';
  } catch {
    return 'network';
  }
}
