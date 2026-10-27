/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Keep in sync with src/lib/palette.ts.
        ink: '#edf0f3',
        panel: '#ffffff',
        line: '#d5dbe2',
        accent: '#b4541e',
        amber: '#a16207',
        danger: '#b42318',
        steel: '#2b6cb0',
        gold: '#a16207',
        drill: '#15803d',
        // Inverted for the light theme: low steps are dark ink, high steps are light,
        // so components written as "text-slate-200 on dark" read as dark text on light.
        // 500 stays at 5:1+ on white for secondary text.
        slate: {
          50: '#172029',
          100: '#1c2630',
          200: '#25303b',
          300: '#323e4a',
          400: '#46525e',
          500: '#5c6975',
          600: '#8a96a3',
          700: '#b3bdc7',
          800: '#d5dbe2',
          900: '#e6eaee',
          950: '#f3f5f7'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        condensed: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'ui-sans-serif', 'sans-serif']
      }
    }
  },
  plugins: []
};
