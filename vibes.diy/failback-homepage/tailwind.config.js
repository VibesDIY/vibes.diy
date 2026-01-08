/** @type {import('tailwindcss').Config} */

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Colors are now defined in app.css using @theme
      screens: {
        xs: "480px",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  plugins: [require("@tailwindcss/typography")],
};
