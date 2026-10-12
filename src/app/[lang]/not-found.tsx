import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getDictionary } from "@/dictionaries";
import { defaultLocale } from "@/i18n/config";

/**
 * Locale-aware 404.
 *
 * `not-found.tsx` does not receive route `params`, so there is no way to know
 * which language the visitor was browsing when the 404 was thrown. Rather than
 * guessing, we render the message in every supported language, each tagged with
 * its own `lang` attribute so screen readers switch voice correctly.
 */
export default async function NotFound() {
  const [en, id] = await Promise.all([getDictionary("en"), getDictionary("id")]);
  const copies = [
    { locale: "en" as const, ...en.common },
    { locale: "id" as const, ...id.common },
  ];

  const primary = copies.find((copy) => copy.locale === defaultLocale) ?? copies[0];

  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>

      {copies.map(({ locale, notFoundTitle, notFoundDescription }) => (
        <div key={locale} lang={locale} className="flex flex-col gap-2">
          <h1
            className={
              locale === primary.locale
                ? "text-3xl font-semibold"
                : "text-muted-foreground text-base font-medium"
            }
          >
            {notFoundTitle}
          </h1>
          <p className="text-muted-foreground max-w-md text-sm">{notFoundDescription}</p>
        </div>
      ))}

      <Button asChild>
        {/* `/` is redirected to the negotiated locale by the proxy. */}
        <Link href="/">{primary.backHome}</Link>
      </Button>
    </div>
  );
}
