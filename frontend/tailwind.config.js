/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Keep in sync with src/lib/palette.ts.
        ink: '#0f1816',
        panel: '#141e1b',
        line: '#24302d',
        accent: '#3fa98f',
        amber: '#c2a24a',
        danger: '#c46a64',
        steel: '#7fa7d1',
        gold: '#c2a24a'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
