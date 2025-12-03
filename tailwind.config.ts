import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // เปลี่ยนตรงนี้ให้ใช้ตัวแปรจาก layout.tsx
        sans: ["var(--font-prompt)", "sans-serif"], 
      },
      colors: {
        primary: {
          DEFAULT: "#FF4DA6",
          hover: "#E03E91",
          light: "#FFE5F1",
        },
        secondary: "#F3F4F6",
        success: "#22C55E",
        muted: "#9CA3AF",
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
};
export default config;