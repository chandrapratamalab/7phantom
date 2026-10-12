/**
 * Central route map.
 * -----------------------------------------------------------------------------
 * Paths are stored **without** a locale prefix. Use `localizedPath(locale, routes.x)`
 * from `@/i18n` to build a real href, so a route is never hand-concatenated.
 */

export const routes = {
  home: "/",
  dashboard: "/dashboard",
  login: "/login",
} as const;

export type RouteName = keyof typeof routes;

/**
 * Route prefixes that require an authenticated session.
 * The proxy redirects unauthenticated visitors; the page re-checks server-side.
 * Add to this list as the PRD grows.
 */
export const protectedRoutePrefixes = ["/dashboard", "/settings"] as const;

export function isProtectedPath(pathnameWithoutLocale: string): boolean {
  return protectedRoutePrefixes.some(
    (prefix) => pathnameWithoutLocale === prefix || pathnameWithoutLocale.startsWith(`${prefix}/`),
  );
}

/**
 * Open-redirect guard for the `?next=` parameter.
 * Only same-origin, absolute paths are allowed.
 */
export function safeRedirectPath(
  candidate: FormDataEntryValue | string | null | undefined,
  fallback: string,
): string {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  return candidate;
}
