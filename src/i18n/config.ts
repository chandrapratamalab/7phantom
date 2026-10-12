/**
 * i18n configuration — the single source of truth for supported languages.
 * -----------------------------------------------------------------------------
 * Adding a language is a 3-step change:
 *   1. Add the locale here (`locales` + `localeMeta`).
 *   2. Add `src/dictionaries/<locale>.json`.
 *   3. Register the loader in `src/dictionaries/index.ts`.
 *
 * Keep this file free of `server-only` imports — the language switcher (a
 * Client Component) reads `locales` / `localeMeta` from here.
 */

export const locales = ["en", "id"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Cookie that remembers the visitor's explicit choice, so the proxy can
 * negotiate a sensible default on the next bare visit to `/`.
 */
export const localeCookieName = "NEXT_LOCALE";

export type LocaleMeta = {
  /** English name — used for `hreflang`/meta and language lists. */
  label: string;
  /** Endonym — how speakers of the language write it. Show this in the UI. */
  nativeLabel: string;
  /** Text direction. RTL locales only need flipping this value. */
  dir: "ltr" | "rtl";
  /** Emoji flag for a dependency-free visual cue. */
  flag: string;
};

export const localeMeta: Record<Locale, LocaleMeta> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr", flag: "🇬🇧" },
  id: { label: "Indonesian", nativeLabel: "Bahasa Indonesia", dir: "ltr", flag: "🇮🇩" },
};

/** Type guard for values coming from URLs, cookies or DB rows. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
