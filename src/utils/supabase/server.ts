/**
 * Server Supabase client — Server Components, Server Actions, Route Handlers.
 * -----------------------------------------------------------------------------
 * Runs as the signed-in user (RLS applies). Never use this to perform
 * privileged operations — that is what `./admin` is for.
 *
 * IMPORTANT: create a **new client per request**. Do not hoist it to a module
 * variable: with streaming/fluid compute a shared instance would leak one user's
 * cookies into another user's request.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env/client";

import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot set cookies.
            // Safe to ignore: `src/proxy.ts` refreshes the session on every
            // request, so the records still get written there.
          }
        },
      },
    },
  );
}
