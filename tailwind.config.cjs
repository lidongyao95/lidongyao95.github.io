/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#e2a045', dark: '#c4882e' },
        bg: { darkest: '#08091a', dark: '#0b0c1f', medium: '#0d1020' },
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
