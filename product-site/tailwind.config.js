/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./public/index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1120px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Inter", "SF Pro Display", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
        brand: {
          DEFAULT: "#e8340a",
          hover: "#c92d08",
          light: "#fff1ee",
          ring: "rgba(232,52,10,0.25)",
          orange: "#f5600a",
          "orange-hover": "#d94f06",
        },
        apple: {
          blue: "#e8340a",
          "blue-hover": "#c92d08",
          black: "#1d1d1f",
          gray: "#6e6e73",
          "gray-light": "#f5f5f7",
          "gray-border": "#d2d2d7",
          link: "#e8340a",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        apple: "980px",
      },
      fontSize: {
        "hero-xl": ["clamp(2.5rem, 6vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "700" }],
        "section-title": ["clamp(1.8rem, 4vw, 3rem)", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "700" }],
        "card-title": ["1.25rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in-left": {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232,52,10,0.35)" },
          "50%": { boxShadow: "0 0 0 10px rgba(232,52,10,0)" },
        },
        "sos-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out both",
        "fade-in-scale": "fade-in-scale 0.5s ease-out both",
        "fade-in-left": "fade-in-left 0.6s ease-out both",
        "fade-in-right": "fade-in-right 0.6s ease-out both",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "sos-blink": "sos-blink 0.8s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};