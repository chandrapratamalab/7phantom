/**
 * Session refresh for the request pipeline (`src/proxy.ts`).
 * -----------------------------------------------------------------------------
 * Why this exists: Server Components cannot write cookies. Without a refresh
 * step, an expired access token would never be rotated and users would be
 * logged out at random. This runs on every request, rotates the tokens, and
 * hands back a response that already carries the new `Set-Cookie` headers.
 *
 * Ordering rule (from Supabase docs): do not run logic *between*
 * `createServerClient(...)` and `supabase.auth.getClaims()`, and call
 * `getClaims()` before you start building a response — otherwise a refresh can
 * complete after the response is committed and the new tokens are lost.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env/client";

/** The subset of JWT claims the app relies on. */
export type SessionClaims = {
  sub: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

export type SessionRefresh = {
  /** Response that already carries rotated cookies + no-store cache headers. */
  response: NextResponse;
  /** JWKS-verified claims, or `null` when signed out. */
  claims: SessionClaims | null;
  /**
   * Headers `@supabase/ssr` wants on the response (`Cache-Control: private,
   * no-store`, …). Must be copied onto any response you return *instead* of
   * `response` — e.g. a locale or auth redirect.
   */
  headers: Record<string, string>;
};

export async function updateSession(request: NextRequest): Promise<SessionRefresh> {
  let response = NextResponse.next({ request });
  const headers: Record<string, string> = {};

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, responseHeaders) {
          // Keep the request in sync so downstream RSC reads see the new token…
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          // …and persist them to the browser.
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          for (const [key, value] of Object.entries(responseHeaders)) {
            headers[key] = value;
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Verifies the JWT signature against the project's JWKS (no per-request
  // network hop) and refreshes the session when needed.
  const { data } = await supabase.auth.getClaims();

  return {
    response,
    claims: (data?.claims ?? null) as SessionClaims | null,
    headers,
  };
}

/**
 * Copy rotated auth cookies + cache headers onto a redirect (or any other)
 * response. Skipping this is the documented cause of "users randomly logged out".
 */
export function inheritSession(target: NextResponse, session: SessionRefresh): NextResponse {
  for (const cookie of session.response.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  for (const [key, value] of Object.entries(session.headers)) {
    target.headers.set(key, value);
  }

  return target;
}
