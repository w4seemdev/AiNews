/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // The real design system lives in src/styles/tokens.css as CSS
      // variables + hand-written component classes. These tokens mirror
      // those values so any Tailwind utility stays on-palette if one is used.
      colors: {
        bg: '#020617', // slate-950 canvas
        surface: {
          DEFAULT: '#0f172a', // slate-900 cards/panels
          raised: '#1e293b', // slate-800 hover/active fills
          alt: '#0a1628',
        },
        line: {
          DEFAULT: '#1e293b', // slate-800 card borders / dividers
          mid: '#334155', // slate-700 input / ghost-button borders
        },
        ink: {
          DEFAULT: '#f1f5f9',
          strong: '#ffffff',
          body: '#cbd5e1',
          muted: '#94a3b8',
          faint: '#64748b',
          ghost: '#475569',
        },
        accent: {
          DEFAULT: '#38bdf8', // sky-400
          light: '#7dd3fc', // sky-300
          deep: '#0ea5e9', // sky-500
        },
        success: '#10b981',
        danger: '#ef4444',
        warning: '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Legacy aliases — the serif/mono roles were retired; both resolve
        // to the Inter stack (use tabular-nums for aligned digits).
        serif: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        header: '0 2px 12px rgba(2, 6, 23, 0.45)',
        badge: '0 2px 8px rgba(2, 6, 23, 0.45)',
        dropdown: '0 16px 40px rgba(0, 0, 0, 0.4)',
        glow: '0 0 32px rgba(56, 189, 248, 0.35)',
        ring: '0 0 0 3px rgba(56, 189, 248, 0.10)',
      },
      maxWidth: {
        page: '1240px',
      },
    },
  },
  plugins: [],
}
