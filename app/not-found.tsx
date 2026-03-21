import Link from 'next/link';

export default function NotFound() {
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
      <h1 style={{ fontSize: '3rem', fontWeight: 700, color: '#c9a227', marginBottom: 8 }}>
        404
      </h1>
      <p style={{ fontSize: '1.125rem', marginBottom: 8 }}>Page not found</p>
      <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: 32, maxWidth: 360 }}>
        This page doesn&apos;t exist. Check the link or go back to the portal.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          backgroundColor: '#c9a227',
          color: '#0f172a',
          fontWeight: 600,
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Go to Pirates Team Portal
      </Link>
    </div>
  );
}
