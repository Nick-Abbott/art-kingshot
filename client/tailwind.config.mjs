/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        nav: "900px",
      },
      colors: {
        ink: "var(--ink)",
        muted: "var(--muted)",
        canvas: "var(--canvas)",
        accent: "var(--accent)",
        "accent-dark": "var(--accent-dark)",
        highlight: "var(--highlight)",
        panel: "var(--panel)",
      },
      boxShadow: {
        soft: "0 16px 30px var(--shadow)",
      },
      borderRadius: {
        xl: "20px",
      },
    },
  },
  plugins: [],
};
