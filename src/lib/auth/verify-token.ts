/**
 * Verify a Supabase-issued JWT without a network call to Auth.
 * -----------------------------------------------------------------------------
 * Use this in Route Handlers / backend-to-backend calls that receive an
 * `Authorization: Bearer <access_token>` header (mobile apps, MCP servers,
 * webhooks with a user context).
 *
 * Verification is done locally against the project's JSON Web Key Set:
 *   SUPABASE_JWKS_URL = {NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json
 *
 * `createRemoteJWKSet` caches the key set, so this stays fast on the hot path.
 */

import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { env } from "@/lib/env/client";
import { getServerEnv } from "@/lib/env/server";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const { SUPABASE_JWKS_URL } = getServerEnv();

    if (!SUPABASE_JWKS_URL) {
      throw new Error(
        "SUPABASE_JWKS_URL is not set. Add it to .env.local to verify bearer tokens locally.",
      );
    }

    jwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
  }

  return jwks;
}

export type VerifiedClaims = JWTPayload & { sub: string; email?: string; role?: string };

/**
 * @throws if the token is missing, malformed, expired or signed by another project.
 */
export async function verifySupabaseJwt(token: string): Promise<VerifiedClaims> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`,
    audience: "authenticated",
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Token is missing the `sub` claim.");
  }

  return payload as VerifiedClaims;
}

/** Strip the `Bearer ` prefix from an `Authorization` header. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}
