import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Languages, Layers, ShieldCheck, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/dictionaries";
import type { Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { localeAlternates, localizedPath } from "@/i18n/locale";
import { routes } from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return {
    description: dict.metadata.description,
    // Emits <link rel="alternate" hreflang="…"> for every supported locale.
    alternates: { languages: localeAlternates(routes.home) },
  };
}

/** One icon per card, in the same order as `home.features` in the dictionaries. */
const featureIcons = [Languages, ShieldCheck, Layers] as const;

/**
 * Landing page — a framework-style starter screen.
 *
 * It is a Server Component: `lang` is already validated by the layout, so it can
 * be trusted here (no second `isLocale()` check) and no client JavaScript ships
 * for this page. Swap the content for your product's real home page.
 */
export default async function HomePage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const home = dict.home;

  return (
    <div className="flex flex-col gap-20 py-10">
      {/* Hero ------------------------------------------------------------------ */}
      <section className="flex flex-col items-center gap-6 text-center">
        <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
          <Terminal className="size-3.5" />
          {home.badge}
        </span>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {home.title}
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">{home.description}</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href={localizedPath(lang, routes.dashboard)}>
              {home.primaryCta}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={localizedPath(lang, routes.login)}>{home.secondaryCta}</Link>
          </Button>
        </div>

        <div className="flex flex-col items-center gap-3 pt-4">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {home.stackLabel}
          </span>
          <ul className="flex flex-wrap justify-center gap-2">
            {home.stack.map((item) => (
              <li
                key={item}
                className="bg-muted/50 text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What's inside --------------------------------------------------------- */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">{home.featuresTitle}</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {home.features.map((feature, index) => {
            const Icon = featureIcons[index] ?? Layers;

            return (
              <Card key={feature.title} className="gap-4">
                <CardHeader>
                  <Icon className="text-primary mb-2 size-5" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  {feature.description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Quick start ----------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{home.quickStartTitle}</h2>

        <div className="overflow-hidden rounded-xl border">
          <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-xs font-medium">
            <Terminal className="size-3.5" />
            <span className="font-mono">terminal</span>
          </div>
          <pre className="overflow-x-auto px-4 py-4 text-sm leading-relaxed">
            <code className="font-mono">
              {home.quickStart.map((command) => `$ ${command}`).join("\n")}
            </code>
          </pre>
        </div>

        <p className="text-muted-foreground text-sm">
          {interpolate(home.editHint, { file: "src/app/[lang]/page.tsx" })}
        </p>
      </section>
    </div>
  );
}
