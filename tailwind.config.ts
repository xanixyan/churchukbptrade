import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0a0a0f",
          800: "#12121a",
          700: "#1a1a25",
          600: "#252535",
        },
        neon: {
          cyan: "#00f0ff",
          purple: "#b026ff",
          pink: "#ff2d95",
        },
      },
      backgroundImage: {
        "gamer-gradient": "linear-gradient(135deg, #00f0ff 0%, #b026ff 100%)",
        "gamer-gradient-subtle": "linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(176,38,255,0.1) 100%)",
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 240, 255, 0.3)",
        "neon-purple": "0 0 20px rgba(176, 38, 255, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
