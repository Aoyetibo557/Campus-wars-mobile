/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain NativeWind classes.
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Semantic tokens — values come from CSS vars injected via vars() at the
      // app root (see src/theme/tokens.ts). Never hardcode hex in components.
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--color-surface-raised) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        "text-muted": "rgb(var(--color-text-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "rank-1": "rgb(var(--color-rank-1) / <alpha-value>)",
        "rank-2": "rgb(var(--color-rank-2) / <alpha-value>)",
        "rank-3": "rgb(var(--color-rank-3) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
