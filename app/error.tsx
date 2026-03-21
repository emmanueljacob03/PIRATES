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
      <p style={{ marginBottom: 24, maxWidth: 480, lineHeight: 1.5 }}>
        The page could not load. If you are on the{' '}
        <strong>live site</strong>, confirm Vercel has{' '}
        <code style={{ color: '#cbd5e1' }}>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code style={{ color: '#cbd5e1' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> set, then redeploy.
        Locally, use the URL from your terminal (e.g. <code style={{ color: '#cbd5e1' }}>http://localhost:4000</code>).
      </p>
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
