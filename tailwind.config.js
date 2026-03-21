/** @type {import('tailwindcss').TailwindConfig} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pirate: {
          gold: '#c9a227',
          dark: '#0f172a',
          navy: '#1e293b',
          cream: '#fef9e7',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
