import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pirates Cricket Portal',
  description: 'Team portal for Pirates Cricket',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
