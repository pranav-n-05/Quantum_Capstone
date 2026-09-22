/** @type {import('tailwindcss').Config} */

// Every colour resolves through a CSS variable holding space-separated RGB
// channels, so `<alpha-value>` keeps working for utilities like
// `bg-signal-amber/10`. The variables themselves are defined per theme in
// src/index.css -- swapping the class on <html> repaints the whole dashboard
// without a single `dark:` variant in the components.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`
const scale = (prefix, stops) =>
  Object.fromEntries(stops.map((stop) => [stop, token(`${prefix}-${stop}`)]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // A cold, instrument-panel palette: near-black slate carrying cyan for
        // live signal and amber for degraded state. In the light theme the
        // ramp inverts -- the same names keep the same *role*.
        lab: scale('lab', [950, 900, 850, 800, 700, 600]),
        slate: scale('slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        signal: {
          cyan: token('signal-cyan'),
          violet: token('signal-violet'),
          amber: token('signal-amber'),
          green: token('signal-green'),
          rose: token('signal-rose'),
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
