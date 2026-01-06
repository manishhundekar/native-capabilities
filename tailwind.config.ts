import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#09090b", card: "#18181b", elevated: "#27272a" },
        border: { DEFAULT: "#27272a", light: "#3f3f46" },
        accent: { DEFAULT: "#3b82f6", hover: "#2563eb" },
      },
    },
  },
  plugins: [],
} satisfies Config;
