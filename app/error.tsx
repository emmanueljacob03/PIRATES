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
      <p style={{ marginBottom: 24, maxWidth: 400 }}>
        The page could not load. Check your connection and that the app is running on the correct URL (e.g. http://localhost:8765).
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
