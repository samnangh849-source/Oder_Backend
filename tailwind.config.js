/** @type {import('tailwindcss').Config} */
export default {
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
      colors: {
        primary: "var(--primary, #3b82f6)",
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
      fontFamily: {
        binance: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
