/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          500: "#4f6ef7",
          600: "#3b56e8",
          700: "#2d41c0",
          900: "#1a2680",
        },
        surface: {
          50:  "#fafafa",
          100: "#f5f5f5",
          200: "#eeeeee",
        },
      },
      screens: {
        xs: "360px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.10)",
        float: "0 8px 32px rgba(0,0,0,0.12)",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease-out both",
        "slide-in": "slideIn 0.3s ease-out both",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        slideIn: {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
