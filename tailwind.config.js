/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1a73e8",
          dark: "#005bbf",
          container: "#c2e7ff",
          onContainer: "#001d35",
        },
        secondary: {
          DEFAULT: "#00897b",
          dark: "#006b5f",
          container: "#8df5e4",
        },
        surface: {
          DEFAULT: "#faf8ff",
          variant: "#eaedff",
          container: "#f0f4f9",
          card: "#ffffff",
        },
        neutral: {
          text: "#1f1f1f",
          muted: "#444746",
          subtle: "#5f6368",
          border: "#e0e3e7",
        }
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}

