/**
 * Browser Supabase client — safe to import from Client Components.
 * -----------------------------------------------------------------------------
 * Uses only the publishable key, which is designed to be public. Access control
 * is enforced by Row Level Security policies in Postgres, never by hiding keys.
 *
 * `createBrowserClient` stores the session in cookies (not localStorage) so the
 * server can read the same session during SSR.
 */

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env/client";

import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
