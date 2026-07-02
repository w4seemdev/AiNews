/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // The real design system ("Calm Dark Editorial") lives in src/index.css
      // as CSS variables + hand-written component classes. These tokens mirror
      // those values so any Tailwind utility stays on-palette if one is used.
      colors: {
        bg: '#0D1117',
        surface: {
          DEFAULT: '#141A22',
          raised: '#1B232E',
        },
        line: '#232C38',
        ink: {
          DEFAULT: '#E8EDF3',
          body: '#C4CDD8',
          muted: '#8A95A4',
        },
        accent: {
          DEFAULT: '#4D8DFF',
          deep: '#2563EB',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
