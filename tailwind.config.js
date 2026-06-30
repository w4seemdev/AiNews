/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // The real design system lives in src/index.css as CSS variables +
      // component classes (the "FORGED STEEL" theme). These tokens just mirror
      // a few values so Tailwind utilities stay on-palette if used.
      colors: {
        ink: {
          950: '#070b14',
          900: '#0b1120',
          850: '#111a2e',
          800: '#18233c',
          700: '#243150',
        },
        accent: {
          DEFAULT: '#2f8bff',
          soft: '#62a8ff',
          deep: '#1f6fe0',
        },
        steel: '#38bdf8',
      },
      fontFamily: {
        head: ['Anton', 'Barlow Condensed', 'sans-serif'],
        cond: ['"Barlow Condensed"', 'Barlow', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
