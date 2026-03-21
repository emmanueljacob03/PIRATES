'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { submitTeamCodeAndGoDashboard } from '@/lib/team-code-submit';

type Step = 'credentials' | 'code' | 'waiting_approval' | 'rejected';

async function loadApprovalStatus(userId: string): Promise<'pending' | 'approved' | 'rejected'> {
  const { data, error } = await supabase.from('profiles').select('approval_status').eq('id', userId).maybeSingle();
  if (error || !data) return 'approved';
  const s = (data as { approval_status?: string }).approval_status;
  if (s === 'pending' || s === 'rejected' || s === 'approved') return s;
  return 'approved';
}

const WELCOME_GATE_STORAGE = 'pirates_welcome_gate_done';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('credentials');
  const [mounted, setMounted] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [teamCode, setTeamCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [codeError, setCodeError] = useState('');
  const teamCodeSubmitLock = useRef(false);

  const fromAchievementsWelcome = searchParams.get('welcome') === '1';
  const urlCodeStatus = searchParams.get('code');

  useEffect(() => {
    const codeInvalid = urlCodeStatus === 'invalid';
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          setStep('credentials');
          setMounted(true);
          return;
        }
        const approval = await loadApprovalStatus(session.user.id);
        if (cancelled) return;
        if (approval === 'pending') {
          setStep('waiting_approval');
          setMounted(true);
          return;
        }
        if (approval === 'rejected') {
          setStep('rejected');
          setMounted(true);
          return;
        }
        const welcomeGateDone =
          typeof window !== 'undefined' && sessionStorage.getItem(WELCOME_GATE_STORAGE) === '1';
        // Achievements flow: show password once; after success we set storage + soft replace (no full reload).
        if (fromAchievementsWelcome && !welcomeGateDone) {
          setStep('credentials');
        } else if (codeInvalid && session) {
          setCodeError('Wrong team code. Please try again.');
          setStep('code');
        } else {
          setStep('code');
        }
        setMounted(true);
      } catch {
        if (!cancelled) setMounted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromAchievementsWelcome, urlCodeStatus]);

  useEffect(() => {
    if (step !== 'waiting_approval') return;
    const id = window.setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const approval = await loadApprovalStatus(session.user.id);
      if (approval === 'approved') {
        setStep('code');
        setMessage({ type: 'ok', text: 'You’re approved. Enter your team code below.' });
      } else if (approval === 'rejected') {
        setStep('rejected');
      }
    }, 8000);
    return () => window.clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('code') === 'expired') setCodeError('Link expired. Enter the team code again and click Go to dashboard.');
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--pirate-dark)] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: 'url(/pirates-emblem.png)' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-[var(--pirate-dark)]/80" />
        <p className="relative z-10 text-slate-400">Loading…</p>
      </div>
    );
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, age: age ? +age : null, phone } },
        });
        if (error) {
          const msg = error.message || '';
          if (
            msg.toLowerCase().includes('already registered') ||
            msg.toLowerCase().includes('user already exists') ||
            msg.toLowerCase().includes('already been registered')
          ) {
            setMessage({ type: 'err', text: 'This email is already registered. Use Log in instead.' });
            return;
          }
          throw error;
        }
        let avatarUrl: string | null = null;
        if (profilePic && data.user) {
          const ext = profilePic.name.split('.').pop();
          const path = `${data.user.id}/avatar.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, profilePic, { upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
            avatarUrl = urlData.publicUrl;
          }
        }
        if (data.user) {
          // @ts-expect-error Supabase client generic inference
          await supabase.from('profiles').update({
            name: name || null,
            age: age ? +age : null,
            phone: phone || null,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          }).eq('id', data.user.id);
        }
        if (data.session) {
          const approval = await loadApprovalStatus(data.session.user.id);
          if (approval === 'pending') {
            setMessage({
              type: 'ok',
              text: 'Account created. Waiting for admin approval before you can continue.',
            });
            setStep('waiting_approval');
          } else if (approval === 'rejected') {
            setStep('rejected');
          } else {
            setMessage({ type: 'ok', text: 'Account created. Now enter your team code below.' });
            setStep('code');
          }
        } else {
          setMessage({
            type: 'ok',
            text: 'Check your email to confirm your account. After you sign in, an admin must approve you before you can use the portal.',
          });
          setStep('credentials');
        }
        if (fromAchievementsWelcome) {
          await supabase.auth.refreshSession().catch(() => {});
          await supabase.auth.getSession();
          if (typeof window !== 'undefined') sessionStorage.setItem(WELCOME_GATE_STORAGE, '1');
          router.replace('/login', { scroll: false });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const raw = error.message || '';
          if (raw.toLowerCase().includes('email not confirmed') || raw.toLowerCase().includes('confirm your email')) {
            setMessage({ type: 'err', text: 'Please confirm your email first. Check your inbox and click the link, then try again.' });
            return;
          }
          setMessage({ type: 'err', text: raw || 'Log in failed. Check your email and password.' });
          return;
        }
        const {
          data: { session: s2 },
        } = await supabase.auth.getSession();
        if (!s2?.user) {
          setMessage({ type: 'err', text: 'Session missing. Try again.' });
          return;
        }
        const approval = await loadApprovalStatus(s2.user.id);
        if (approval === 'pending') {
          setMessage({ type: 'ok', text: 'Waiting for admin approval.' });
          setStep('waiting_approval');
        } else if (approval === 'rejected') {
          setStep('rejected');
        } else {
          setMessage({ type: 'ok', text: 'You are logged in. Now enter your team code.' });
          setStep('code');
        }
        if (fromAchievementsWelcome) {
          await supabase.auth.refreshSession().catch(() => {});
          await supabase.auth.getSession();
          if (typeof window !== 'undefined') sessionStorage.setItem(WELCOME_GATE_STORAGE, '1');
          router.replace('/login', { scroll: false });
        }
      }
    } catch (err: unknown) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleTeamCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCodeError('');
    const code = teamCode.trim();
    if (!code) {
      setCodeError('Enter the team code.');
      return;
    }
    if (teamCodeSubmitLock.current) return;
    teamCodeSubmitLock.current = true;
    setLoading(true);
    const result = await submitTeamCodeAndGoDashboard(code);
    if (result === 'ok') return;
    teamCodeSubmitLock.current = false;
    setLoading(false);
    if (result === 'invalid') setCodeError('Wrong team code. Please try again.');
    else setCodeError('Network error. Try again.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 py-8 overflow-hidden">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: 'url(/pirates-emblem.png)' }}
        aria-hidden
      />
      <div className="fixed inset-0 bg-[var(--pirate-dark)]/85" />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-3 mb-6 no-underline">
          <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden border-2 border-[var(--pirate-yellow)] bg-[var(--pirate-navy)]">
            <img src="/pirates-emblem.png" alt="" className="w-full h-full object-cover object-center" />
          </div>
          <span className="text-3xl font-bold tracking-wide uppercase" style={{ color: 'var(--pirate-yellow)' }}>
            PIRATES
          </span>
        </Link>
        <p className="text-center text-slate-400 text-sm mb-6">
          Log in or create an account to continue.
        </p>

        {step === 'credentials' && (
          <section
            className="bg-slate-800 border border-slate-600 rounded-xl p-6 shadow-xl"
            aria-labelledby="login-heading"
          >
            <h2 id="login-heading" className="sr-only">
              Log in or create account
            </h2>
            {message && (
              <p
                role="alert"
                className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'err' ? 'bg-red-900/40 text-red-200' : 'bg-green-900/40 text-green-200'}`}
              >
                {message.text}
              </p>
            )}
            <form onSubmit={handleCredentials} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label htmlFor="name" className="block text-slate-300 text-sm font-medium mb-1">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="age" className="block text-slate-300 text-sm font-medium mb-1">
                      Age (optional)
                    </label>
                    <input
                      id="age"
                      type="number"
                      min="1"
                      max="120"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="Age"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-slate-300 text-sm font-medium mb-1">
                      Phone (optional)
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label htmlFor="photo" className="block text-slate-300 text-sm font-medium mb-1">
                      Photo (optional)
                    </label>
                    <input
                      id="photo"
                      type="file"
                      accept="image/*"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-amber-500 file:text-slate-900"
                      onChange={(e) => setProfilePic(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="email" className="block text-slate-300 text-sm font-medium mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-slate-300 text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Log in'}
              </button>
            </form>
            <p className="mt-4 text-center">
              <button
                type="button"
                className="text-amber-400 hover:text-amber-300 underline text-sm"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
              >
                {isSignUp
                  ? fromAchievementsWelcome
                    ? 'Already have an account! SIGN IN'
                    : 'Already have an account? Log in'
                  : 'No account? Create one'}
              </button>
            </p>
          </section>
        )}

        {step === 'waiting_approval' && (
          <section className="bg-slate-800 border border-amber-500/30 rounded-xl p-6 shadow-xl text-center">
            <h2 className="text-xl font-semibold text-amber-400 mb-2">Waiting for approval</h2>
            <p className="text-slate-300 text-sm mb-4">
              An admin must approve your account before you can enter the team code and open the dashboard. This page
              checks every few seconds, or tap below to refresh.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg"
                onClick={async () => {
                  const {
                    data: { session },
                  } = await supabase.auth.getSession();
                  if (!session?.user) return;
                  const a = await loadApprovalStatus(session.user.id);
                  if (a === 'approved') {
                    setMessage({ type: 'ok', text: 'You’re approved. Enter your team code below.' });
                    setStep('code');
                  } else if (a === 'rejected') {
                    setStep('rejected');
                  }
                }}
              >
                Check status
              </button>
              <button
                type="button"
                className="py-2.5 px-4 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg"
                onClick={async () => {
                  if (typeof window !== 'undefined') sessionStorage.removeItem(WELCOME_GATE_STORAGE);
                  await supabase.auth.signOut();
                  setStep('credentials');
                  setMessage(null);
                }}
              >
                Sign out
              </button>
            </div>
          </section>
        )}

        {step === 'rejected' && (
          <section className="bg-slate-800 border border-red-900/50 rounded-xl p-6 shadow-xl text-center">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Not approved</h2>
            <p className="text-slate-300 text-sm mb-4">
              Your sign-up was not approved. Contact your team admin if you think this is a mistake.
            </p>
            <button
              type="button"
              className="py-2.5 px-4 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg"
              onClick={async () => {
                if (typeof window !== 'undefined') sessionStorage.removeItem(WELCOME_GATE_STORAGE);
                await supabase.auth.signOut();
                setStep('credentials');
                setMessage(null);
              }}
            >
              Back to sign in
            </button>
          </section>
        )}

        {step === 'code' && (
          <section
            className="bg-slate-800 border border-slate-600 rounded-xl p-6 shadow-xl"
            aria-labelledby="code-heading"
          >
            <h2 id="code-heading" className="text-xl font-semibold text-amber-400 mb-1">
              Enter your team code
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Only people with the team code can open the dashboard.
            </p>
            {message?.type === 'ok' && (
              <p className="mb-4 p-3 rounded-lg text-sm bg-green-900/40 text-green-200" role="status">
                {message.text}
              </p>
            )}
            <form onSubmit={handleTeamCodeSubmit} className="space-y-4">
              <div>
                <label htmlFor="teamcode" className="block text-slate-300 text-sm font-medium mb-1">
                  Team code
                </label>
                <input
                  id="teamcode"
                  type="text"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  placeholder="Enter the code"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {codeError && (
                <p role="alert" className="text-red-400 text-sm">
                  {codeError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="py-2.5 px-4 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-800"
                  onClick={() => {
                    teamCodeSubmitLock.current = false;
                    setLoading(false);
                    if (typeof window !== 'undefined') sessionStorage.removeItem(WELCOME_GATE_STORAGE);
                    setStep('credentials');
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Checking…' : 'Go to dashboard'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
