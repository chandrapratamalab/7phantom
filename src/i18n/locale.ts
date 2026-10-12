/**
 * Locale routing + negotiation helpers.
 * -----------------------------------------------------------------------------
 * Pure functions, no dependencies and no `next/*` imports, so they can be used
 * from the proxy (edge-like runtime), Server Components, Client Components and
 * tests alike.
 */

import { defaultLocale, isLocale, locales, type Locale } from "./config";

/** Absolute, locale-prefixed path. `localizedPath("id", "/dashboard")` -> `/id/dashboard` */
export function localizedPath(locale: Locale, pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

/**
 * Split the leading `[lang]` segment off a pathname.
 * `/id/dashboard` -> { locale: "id", pathname: "/dashboard" }
 * `/dashboard`    -> { locale: null, pathname: "/dashboard" }
 */
export function stripLocale(pathname: string): { locale: Locale | null; pathname: string } {
  const segments = pathname.split("/").filter(Boolean);
  const [first, ...rest] = segments;

  if (isLocale(first)) {
    return { locale: first, pathname: rest.length > 0 ? `/${rest.join("/")}` : "/" };
  }

  return { locale: null, pathname };
}

/**
 * Swap the locale of an already-localized path, preserving the rest of the URL.
 * Used by the `<LanguageSwitcher />`.
 * `/en/dashboard?tab=notes` pathname -> `swapLocale("/en/dashboard", "id")` -> `/id/dashboard`
 */
export function swapLocale(pathname: string, nextLocale: Locale): string {
  const { pathname: rest } = stripLocale(pathname);
  return localizedPath(nextLocale, rest);
}

/**
 * Minimal RFC 9110 `Accept-Language` parser.
 *
 * We hand-roll this instead of pulling in `negotiator` +
 * `@formatjs/intl-localematcher`: it keeps the proxy dependency-free and the
 * behaviour is easy to reason about. Region subtags collapse to their base
 * language (`en-US` -> `en`, `id-ID` -> `id`).
 */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);

      return {
        tag: (tag ?? "").trim().toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}

/**
 * Pick the best supported locale for a request.
 *
 * Priority: explicit cookie choice -> `Accept-Language` -> `defaultLocale`.
 */
export function negotiateLocale(
  acceptLanguage: string | null,
  cookieLocale?: string | null,
): Locale {
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  if (!acceptLanguage) {
    return defaultLocale;
  }

  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const base = tag.split("-")[0];
    if (isLocale(base)) {
      return base;
    }
  }

  return defaultLocale;
}

/** `hreflang` alternates for `generateMetadata` / sitemaps. */
export function localeAlternates(pathname: string): Record<string, string> {
  return Object.fromEntries(locales.map((locale) => [locale, localizedPath(locale, pathname)]));
}
