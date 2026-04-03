/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // 'Syne' for that bold, automotive display look
        display: ["Syne", "sans-serif"],
        // 'Plus Jakarta Sans' for everything else
        sans: ["Plus Jakarta Sans", "sans-serif"],
        // 'JetBrains Mono' for technical/AI elements
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};