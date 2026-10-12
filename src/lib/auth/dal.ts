/**
 * Data Access Layer — the ONLY place that is allowed to touch user data.
 * -----------------------------------------------------------------------------
 * Next.js recommends a DAL between your UI and the database so that
 * authentication and authorization live in one auditable place, and Server
 * Actions stay thin. Nothing here trusts the caller: every function re-derives
 * the user from the request.
 *
 * `server-only` + React `cache()` means: importable only from server code, and
 * called at most once per render pass.
 */

import "server-only";

import { cache } from "react";

import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/locale";
import { routes } from "@/lib/routes";
import { createClient } from "@/utils/supabase/server";

/**
 * Cheap identity check for *UI decisions* (show/hide a button).
 * Verifies the JWT signature against JWKS; no network round-trip.
 * Do NOT use this to authorize a mutation — use `requireUser()`.
 */
export const getClaims = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return data.claims;
});

/**
 * Authoritative identity check. `getUser()` calls Supabase Auth and validates
 * the token server-side, so it is safe to base authorization on.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
});

/**
 * Use at the top of any page/action that mutates or exposes private data:
 *
 *   const user = await requireUser(lang);
 *
 * The proxy already redirects unauthenticated visitors, but this second check is
 * mandatory — pages, Server Actions and Route Handlers are all independent entry
 * points into the app.
 */
export async function requireUser(locale: Locale) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(localizedPath(locale, routes.login));
  }

  return user;
}
