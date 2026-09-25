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
        accent: '#17ad8e',
        amber: '#c9a437',
        danger: '#cf6761',
        steel: '#7caadb',
        gold: '#c9a437'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
