/**
 * Admin (service-role) Supabase client — SERVER ONLY.
 * -----------------------------------------------------------------------------
 * ⚠️  This client BYPASSES Row Level Security. Anything it touches, it can read
 *     and write for every tenant. Treat every call site as security-sensitive.
 *
 * Defence in depth:
 *   1. `import "server-only"` — the build fails if a Client Component imports it.
 *   2. The key is read through `@/lib/env/server`, never `process.env` directly,
 *      so it can never be referenced from a module that ships to the browser.
 *   3. Session persistence is disabled: this client is stateless and must never
 *      carry a user's cookies.
 *
 * Legitimate uses: admin dashboards, cron/background jobs, privileged webhooks,
 * `auth.admin.*` operations. For everything else, use `./server`.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env/client";
import { getServerEnv } from "@/lib/env/server";

import type { Database } from "./types";

export function createAdminClient() {
  const { SUPABASE_SECRET_KEY } = getServerEnv();

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Makes privileged traffic obvious in Supabase logs / audit trails.
        "x-client-info": "7phantom:admin",
      },
    },
  });
}
