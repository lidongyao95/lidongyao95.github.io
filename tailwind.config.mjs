/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#00ff88', dark: '#00cc6a' },
        bg: { darkest: '#06060a', dark: '#0a0a0f', medium: '#0d1117' },
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
