import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, isLocale } from "@/i18n/config";
import { localizedPath } from "@/i18n/locale";
import { env } from "@/lib/env/client";
import { routes, safeRedirectPath } from "@/lib/routes";
import { createClient } from "@/utils/supabase/server";

/**
 * PKCE callback for email confirmation, magic links and OAuth.
 *
 * Not localized on purpose: the URL must be identical in every language, and
 * `/auth/*` is excluded from the proxy matcher.
 *
 * Configure the redirect allow-list in the Supabase dashboard:
 *   Authentication -> URL Configuration -> Redirect URLs
 *     http://localhost:3000/auth/callback
 *     https://your-domain.com/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const localeParam = searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;

  const fallback = localizedPath(locale, routes.dashboard);
  const next = safeRedirectPath(searchParams.get("next"), fallback);

  if (!code) {
    return NextResponse.redirect(
      new URL(`${localizedPath(locale, routes.login)}?error=callback`, env.NEXT_PUBLIC_SITE_URL),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`${localizedPath(locale, routes.login)}?error=callback`, env.NEXT_PUBLIC_SITE_URL),
    );
  }

  // Absolute URL built from the canonical origin, not from request headers
  // (which can be spoofed behind a proxy).
  return NextResponse.redirect(new URL(next, env.NEXT_PUBLIC_SITE_URL));
}
