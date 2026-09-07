import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7F8F7",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#0D7A5F",
          hover: "#0A634D",
          light: "#E8F5F1",
          50: "#F0FDF4",
          100: "#DCFCE7",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
        charcoal: {
          DEFAULT: "#1A1D1F",
          secondary: "#6F767E",
          muted: "#9A9FA5",
          border: "#EFEFEF",
        },
        status: {
          green: "#059669",
          greenBg: "#DEF7EC",
          amber: "#D97706",
          amberBg: "#FEF3C7",
          red: "#DC2626",
          redBg: "#FEE2E2",
          gray: "#6B7280",
          grayBg: "#F3F4F6",
        }
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.04)",
        cardHover: "0 8px 24px rgba(0, 0, 0, 0.07)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      }
    },
  },
  plugins: [],
};
export default config;
