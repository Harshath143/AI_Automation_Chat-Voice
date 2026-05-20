/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0b0f19",
          card: "#151c2c",
          hover: "#1e293b"
        },
        primary: {
          DEFAULT: "#3b82f6",
          dark: "#1d4ed8",
          light: "#60a5fa"
        },
        accent: {
          DEFAULT: "#8b5cf6",
          light: "#a78bfa"
        },
        success: {
          DEFAULT: "#10b981",
          light: "#34d399"
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24"
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "#f87171"
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
      }
    },
  },
  plugins: [],
}
