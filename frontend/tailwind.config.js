/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--bg-color)",
          card: "var(--card-bg)",
          hover: "var(--hover-bg)",
          border: "var(--border-color)",
          dark: {
            DEFAULT: "#0f090d",
            card: "#1c1218",
            hover: "#2a1b24"
          }
        },
        primary: {
          DEFAULT: "#D48A04", // BVS Gold
          dark: "#b57300",
          light: "#ffb224"
        },
        secondary: {
          DEFAULT: "#4a122e", // BVS Burgundy
          dark: "#2a0515",
          light: "#8c3b68"
        },
        accent: {
          DEFAULT: "#8c3b68", // BVS Plum/Accent
          light: "#a2527e"
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
