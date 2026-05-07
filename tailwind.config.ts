import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Reuse the existing dark theme tokens from css/main.css so we can
        // migrate components incrementally without visual breakage.
        bg: {
          DEFAULT: "#0f1117",
          elevated: "#161922",
          hover: "#1f2330",
        },
        border: {
          DEFAULT: "#262b38",
          strong: "#3a4151",
        },
        accent: {
          DEFAULT: "#4f8cff",
          hover: "#6ba0ff",
        },
        text: {
          DEFAULT: "#e6e9ef",
          muted: "#8b94a7",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
