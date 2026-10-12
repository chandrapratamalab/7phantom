import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";

import "../globals.css";

import { SiteHeader } from "@/components/features/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getDictionary } from "@/dictionaries";
import { isLocale, localeMeta, locales } from "@/i18n/config";

/**
 * Root layout — it lives inside the `[lang]` segment, which is what makes the
 * whole route tree locale-aware. Everything Next.js renders underneath
 * (`loading`, `not-found`, error boundaries) inherits `lang`/`dir`.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Pre-render one tree per language at build time. */
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  if (!isLocale(lang)) {
    return {};
  }

  const dict = await getDictionary(lang);

  return {
    // `metadataBase` turns relative URLs (OG images, alternates) into absolute ones.
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: dict.metadata.title, template: `%s · ${dict.metadata.title}` },
    description: dict.metadata.description,
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  // The proxy already redirects unknown locales; this is the authoritative guard.
  if (!isLocale(lang)) {
    notFound();
  }

  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      dir={localeMeta[lang].dir}
      // Tells Next.js the page scrolls smoothly (globals.css sets `scroll-smooth`),
      // so it can suppress the "missing data-scroll-behavior" warning.
      data-scroll-behavior="smooth"
      // The theme provider writes the theme class before hydration (a
      // server-injected script), so the class attribute may differ.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="bg-background text-foreground flex min-h-dvh flex-col font-sans">
        <ThemeProvider defaultTheme="system" enableSystem disableTransitionOnChange>
          <a
            href="#main"
            className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:shadow"
          >
            {dict.common.skipToContent}
          </a>

          <SiteHeader lang={lang} dict={dict} />

          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
            {children}
          </main>

          <footer className="border-t">
            <div className="text-muted-foreground mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm">
              <p>
                © {new Date().getFullYear()} {dict.common.appName}
              </p>
              <p lang="en" className="font-mono text-xs uppercase">
                {lang}
              </p>
            </div>
          </footer>

          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
