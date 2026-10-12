import { NextResponse, type NextRequest } from "next/server";

import { readBearerToken, verifySupabaseJwt } from "@/lib/auth/verify-token";

/**
 * Example stateless API endpoint.
 *
 * Unlike pages (cookie session), API routes expect a bearer access token — this
 * is the shape mobile apps, CLIs and MCP clients use. Verification happens
 * locally against the project JWKS (`SUPABASE_JWKS_URL`); no session cookie is
 * required and no Supabase round-trip is made.
 *
 * Excluded from the proxy matcher, so it is never redirected to a locale path.
 */
export async function GET(request: NextRequest) {
  const token = readBearerToken(request);

  if (!token) {
    return NextResponse.json(
      { error: "missing_token" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  try {
    const claims = await verifySupabaseJwt(token);

    return NextResponse.json({
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      role: typeof claims.role === "string" ? claims.role : null,
    });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
