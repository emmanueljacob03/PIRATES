'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c9a227', marginBottom: 16 }}>
        Something went wrong
      </h1>
      <p style={{ marginBottom: 16, maxWidth: 520, lineHeight: 1.5 }}>
        The page hit a runtime error. On the <strong>live site</strong>, the usual fix is Vercel{' '}
        <strong>Project → Settings → Environment Variables</strong>: set{' '}
        <code style={{ color: '#cbd5e1' }}>NEXT_PUBLIC_SUPABASE_URL</code> (full{' '}
        <code style={{ color: '#cbd5e1' }}>https://….supabase.co</code> URL) and{' '}
        <code style={{ color: '#cbd5e1' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (anon public key only), apply
        to <strong>Production</strong>, then <strong>Redeploy</strong>. Locally, copy{' '}
        <code style={{ color: '#cbd5e1' }}>.env.local.example</code> to <code style={{ color: '#cbd5e1' }}>.env.local</code>{' '}
        and run <code style={{ color: '#cbd5e1' }}>npm run dev</code> (see terminal for the URL, often port 4000).
      </p>
      {(error?.message || error?.digest) && (
        <pre
          style={{
            marginBottom: 24,
            maxWidth: 560,
            width: '100%',
            padding: 12,
            borderRadius: 8,
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            fontSize: '0.8rem',
            textAlign: 'left',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error.digest ? `[${error.digest}] ` : ''}
          {error.message || 'Unknown error'}
        </pre>
      )}
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: '12px 24px',
          backgroundColor: '#c9a227',
          color: '#0f172a',
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 16,
          color: '#94a3b8',
          fontSize: '0.875rem',
        }}
      >
        Go to Pirates Team Portal
      </a>
    </div>
  );
}
