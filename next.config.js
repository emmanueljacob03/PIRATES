/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Tesseract + HEIC helper need to be bundled cleanly for the scorecard OCR client chunk. */
  transpilePackages: ['tesseract.js', 'heic2any'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/**' },
    ],
  },
};

module.exports = nextConfig;
