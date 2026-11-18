import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#040a12",
          900: "#06111d",
          850: "#081726",
          800: "#0b1d2e",
          700: "#0f2a3d",
        },
        graphite: {
          950: "#080b10",
          900: "#0d1118",
          800: "#121924",
          700: "#1a2330",
        },
        cyan: {
          300: "#7df9ff",
          400: "#2ee8f5",
          500: "#00d8e8",
          600: "#00aebf",
          glow: "rgba(46,232,245,0.16)",
        },
        gold: {
          300: "#f8dda0",
          400: "#f1c66d",
          500: "#d9a94a",
          600: "#b88a2f",
        },
        soft: "#eef6f8",
        muted: "#8ba3b3",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(46,232,245,0.12)",
        "glow-strong": "0 0 60px rgba(46,232,245,0.22)",
        gold: "0 0 30px rgba(241,198,109,0.12)",
      },
      backgroundImage: {
        "radial-cyan": "radial-gradient(circle at center, rgba(46,232,245,0.18), transparent 65%)",
        "radial-gold": "radial-gradient(circle at center, rgba(241,198,109,0.16), transparent 65%)",
      },
      animation: {
        "pulse-slow": "pulse-slow 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        scan: "scan 7s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "spin-slow": "spin 18s linear infinite",
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.9" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;