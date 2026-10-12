/**
 * Dictionary loader — Server Components only.
 * -----------------------------------------------------------------------------
 * `import "server-only"` makes the build fail loudly if a Client Component ever
 * imports this module, so a dictionary can never accidentally ship a server
 * dependency into the browser bundle.
 *
 * Dictionaries are lazy (`import()`), so only the active locale is loaded and
 * each language becomes its own chunk.
 */

import "server-only";

import type en from "./en.json";

import type { Locale } from "@/i18n/config";

/**
 * Shape of a dictionary, derived from the reference locale (`en.json`).
 * `Record<Locale, () => Promise<Dictionary>>` below makes TypeScript enforce
 * that every other locale file has exactly the same keys — a missing translation
 * is a compile error, not a runtime `undefined`.
 *
 * `import type` is erased at build time, so this costs nothing at runtime and
 * keeps the dictionaries lazy.
 */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./en.json").then((module) => module.default),
  id: () => import("./id.json").then((module) => module.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
