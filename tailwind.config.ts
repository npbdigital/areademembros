import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sistema de design Academia NPB (do protótipo do colega)
        npb: {
          gold: "#c9922a",
          "gold-light": "#e8b84b",
          "gold-dim": "#7a5618",
          bg: "#0d0d0d",
          bg2: "#161616",
          bg3: "#1e1e1e",
          bg4: "#252525",
          text: "#f0f0f0",
          "text-muted": "#888888",
          border: "#2a2a2a",
        },
        // shadcn/ui (mantém compat com componentes da lib)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "npb-gold-gradient": "linear-gradient(135deg, #c9922a, #7a5618)",
        "npb-sidebar": "linear-gradient(180deg, #1a1500 0%, #0d0d0d 100%)",
        "npb-curso-hero": "linear-gradient(135deg, #0d0d0d 0%, #1a1200 100%)",
      },
      boxShadow: {
        "npb-gold": "0 0 16px rgba(201,146,42,0.4)",
        "npb-card-hover": "0 8px 24px rgba(201,146,42,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
