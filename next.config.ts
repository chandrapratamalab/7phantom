import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * Notes on this stack:
 * - Turbopack is top-level in Next.js 16 (no longer `experimental`).
 * - `typedRoutes` is intentionally off: the app builds hrefs at runtime from the
 *   active locale. Turn it on (`typedRoutes: true`) once the route surface is
 *   stable and you are ready to thread `Route` types through `localizedPath`.
 * - Images coming from Supabase Storage are allow-listed here. Set your project
 *   ref via NEXT_PUBLIC_SUPABASE_URL and, if you use a custom domain, add it.
 */
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },

  async headers() {
    return [
      {
        // Baseline hardening headers. Tune `Content-Security-Policy` for your PRD.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
