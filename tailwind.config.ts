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
        // Surface hierarchy — dark navy range
        surface: {
          base:     "#080E1A",
          sunken:   "#060C16",
          elevated: "#0F1B2D",
          overlay:  "#162338",
          border:   "#1E3352",
          hover:    "#1A2D47",
        },
        // Text hierarchy
        text: {
          primary:     "#F0F4FA",
          secondary:   "#8FA3BF",
          muted:       "#506280",
          placeholder: "#364D66",
          inverse:     "#080E1A",
        },
        // Accent — blue for actions and active states
        accent: {
          DEFAULT: "#3B7FEB",
          hover:   "#2E6DD6",
          active:  "#2560BF",
          subtle:  "#162338",
          muted:   "#1E3352",
        },
        // Semantic document states
        success: {
          DEFAULT: "#22C55E",
          subtle:  "#052E16",
          border:  "#14532D",
          text:    "#4ADE80",
        },
        warning: {
          DEFAULT: "#F59E0B",
          subtle:  "#2D1B00",
          border:  "#451A00",
          text:    "#FCD34D",
        },
        danger: {
          DEFAULT: "#EF4444",
          subtle:  "#1C0D0D",
          border:  "#450A0A",
          text:    "#F87171",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs:   ["0.75rem",  { lineHeight: "1rem" }],
        sm:   ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem",     { lineHeight: "1.5rem" }],
        lg:   ["1.125rem", { lineHeight: "1.75rem" }],
        xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem",  { lineHeight: "2rem" }],
        "3xl": ["1.875rem",{ lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem",    { lineHeight: "1" }],
      },
      borderRadius: {
        sm:   "0.375rem",
        md:   "0.5rem",
        lg:   "0.75rem",
        xl:   "1rem",
        "2xl":"1.25rem",
      },
      boxShadow: {
        card:  "0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)",
        modal: "0 20px 60px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
