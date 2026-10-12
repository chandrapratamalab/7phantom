/**
 * Tailwind CSS v4 — hybrid configuration.
 * -----------------------------------------------------------------------------
 * Tailwind v4 is **CSS-first**: the design system (colors, radii, dark mode)
 * lives in `src/app/globals.css` via `@theme` / `@custom-variant`. That file is
 * the single source of truth for shadcn/ui CSS variables.
 *
 * This JS/TS file exists only for the few things that are still nicer in
 * config-land, and is loaded by `globals.css` with:
 *
 *     @config "../../tailwind.config.ts";
 *
 * Keep it lean. Do NOT re-declare colors here — they are defined as CSS
 * variables so they can be themed/swapped per-locale or per-tenant at runtime.
 *
 * @see https://tailwindcss.com/docs/functions-and-directives#config-directive
 */

const config = {
  /**
   * `class` (not `media`) so the theme provider can toggle dark mode and the
   * user choice can be persisted to localStorage. Mirrored in globals.css by
   * `@custom-variant dark`.
   */
  darkMode: "class",

  /**
   * Tailwind v4 auto-detects source files, but listing them is explicit and
   * slightly faster. `.mdx` is included for content pages.
   */
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/dictionaries/**/*.json",
  ],

  theme: {
    extend: {
      /**
       * Wired to `next/font` CSS variables (see `src/app/[lang]/layout.tsx`).
       * The fallbacks keep text CLS-free while the webfont loads.
       */
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      /**
       * Radius scale derived from the single `--radius` token. shadcn/ui reads
       * `rounded-lg` etc., so changing `--radius` re-themes every component.
       */
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },

      /**
       * Container for marketing/PRD pages. Add viewport-based breakpoints here
       * rather than inventing ad-hoc max-widths in components.
       */
      container: {
        center: true,
        padding: "1.5rem",
        screens: {
          "2xl": "1400px",
        },
      },
    },
  },

  plugins: [],
};

export default config;
