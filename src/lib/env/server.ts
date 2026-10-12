/**
 * PRIVATE environment variables — SERVER ONLY.
 * -----------------------------------------------------------------------------
 * `import "server-only"` guarantees the Next.js build fails if this module is
 * ever reached from a Client Component. This is the single most important guard
 * against leaking `SUPABASE_SECRET_KEY` to the browser.
 *
 * Values are validated lazily (on first use) so that public pages can be built
 * and served without admin credentials configured.
 */

import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  /**
   * Secret API key (e.g. `sb_secret_...`, formerly the `service_role` key).
   * BYPASSES Row Level Security — only ever used by `@/utils/supabase/admin`.
   */
  SUPABASE_SECRET_KEY: z.string().min(1, { message: "SUPABASE_SECRET_KEY is required." }),

  /**
   * JWKS endpoint for verifying Supabase-issued user JWTs locally, with no
   * network round-trip per request:
   *   {NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json
   */
  SUPABASE_JWKS_URL: z.url().optional(),

  /** Direct Postgres connection string (migrations / `withPostgresClient`). */
  SUPABASE_DB_URL: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) {
    return cached;
  }

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid server environment variables.\n${details}\n\n` +
        `These are server-only. Set them in \`.env.local\` (never in NEXT_PUBLIC_*).`,
    );
  }

  cached = parsed.data;
  return cached;
}
