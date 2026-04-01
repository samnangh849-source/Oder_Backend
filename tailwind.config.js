/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Kantumruy Pro"', 'sans-serif'],
        display: ['"Rajdhani"', '"Kantumruy Pro"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        khmer: ['"Kantumruy Pro"', 'sans-serif'],
        binance: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: "var(--primary, #3b82f6)",
        dark: {
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
        },
        brand: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          pink: '#ec4899'
        },
        binance: {
          yellow: '#FCD535',
          black: '#0B0E11',
          dark: '#1E2329',
          card: '#1E2329',
          border: '#2B3139',
          hover: '#2B3139',
          text: '#EAECEF',
          muted: '#848E9C',
          green: '#0ECB81',
          red: '#F6465D',
          highlight: '#474D57',
        },
      },
    },
  },
  plugins: [],
}
