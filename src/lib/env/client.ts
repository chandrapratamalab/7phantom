/**
 * PUBLIC environment variables.
 * -----------------------------------------------------------------------------
 * Everything here is inlined into the browser bundle by Next.js, so it is
 * importable from both Server and Client Components.
 *
 * Rule: `NEXT_PUBLIC_*` values are **not secrets**. Never put `SUPABASE_SECRET_KEY`
 * (or any service-role key) here — use `@/lib/env/server` instead.
 *
 * Validation is **lazy**: `next build` evaluates the module graph of every route
 * (including route handlers) to collect page metadata, so parsing at import time
 * would make the build fail on a fresh clone. Values are parsed on first read.
 *
 * The `process.env.NEXT_PUBLIC_*` references must stay literal for Next.js to
 * statically inline them into the client bundle.
 */

import { z } from "zod";

const clientEnvSchema = z.object({
  /** e.g. https://abcdefghijklm.supabase.co */
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL." }),

  /** e.g. sb_publishable_... — safe in the browser; RLS is the real guard. */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, { message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required." }),

  /** Canonical origin, used to build absolute redirect URLs. */
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cached: ClientEnv | null = null;

function loadClientEnv(): ClientEnv {
  if (cached) {
    return cached;
  }

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid public environment variables.\n${details}\n\n` +
        `Fix: copy \`.env.example\` to \`.env.local\` and fill in the values.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Lazily-validated public env. Reads like a plain object: `env.NEXT_PUBLIC_SUPABASE_URL`. */
export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return loadClientEnv().NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY() {
    return loadClientEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  },
  get NEXT_PUBLIC_SITE_URL() {
    return loadClientEnv().NEXT_PUBLIC_SITE_URL;
  },
} satisfies ClientEnv;
