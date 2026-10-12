/**
 * Request pipeline: i18n routing + Supabase session refresh + route protection.
 * -----------------------------------------------------------------------------
 * In Next.js 16 `middleware.ts` was renamed to `proxy.ts` (exported function
 * `proxy`). The runtime is always Node.js.
 *
 * Order matters, and this order is deliberate:
 *   1. Refresh the Supabase session (also keeps cookies in sync).
 *   2. Ensure the URL carries a locale prefix — redirect if it does not.
 *   3. Gate protected routes.
 *   4. Remember the visitor's language choice in a cookie.
 *
 * Every redirect inherits the refreshed auth cookies via `inheritSession`,
 * otherwise a token rotation that happens on this request would be dropped and
 * the user would be signed out.
 */

import { NextResponse, type NextRequest } from "next/server";

import { localeCookieName } from "@/i18n/config";
import { localizedPath, negotiateLocale, stripLocale } from "@/i18n/locale";
import { isProtectedPath, routes } from "@/lib/routes";
import { inheritSession, updateSession } from "@/utils/supabase/middleware";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Refresh the session first — `getClaims()` must run before we build a response.
  const session = await updateSession(request);

  const { locale: pathLocale, pathname: pathnameWithoutLocale } = stripLocale(pathname);

  // 2. No locale in the URL: negotiate one and redirect (e.g. `/` -> `/en`).
  if (!pathLocale) {
    const locale = negotiateLocale(
      request.headers.get("accept-language"),
      request.cookies.get(localeCookieName)?.value,
    );

    const url = request.nextUrl.clone();
    url.pathname = localizedPath(locale, pathname);

    return inheritSession(NextResponse.redirect(url), session);
  }

  // 3. Protected routes require authentication.
  if (isProtectedPath(pathnameWithoutLocale) && !session.claims) {
    const url = request.nextUrl.clone();
    url.pathname = localizedPath(pathLocale, routes.login);
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;

    return inheritSession(NextResponse.redirect(url), session);
  }

  // 4. Persist the explicit language choice for future bare visits to `/`.
  if (request.cookies.get(localeCookieName)?.value !== pathLocale) {
    session.response.cookies.set(localeCookieName, pathLocale, {
      path: "/",
      maxAge: ONE_YEAR_IN_SECONDS,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return session.response;
}

export const config = {
  /**
   * Run on pages only. Static assets, image optimizer, API routes and the
   * auth callback are excluded — API routes authenticate with a bearer token
   * (see `src/lib/auth/verify-token.ts`) and `/auth/callback` is not localized.
   */
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2)$).*)",
  ],
};
