"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localeCookieName, localeMeta, locales, type Locale } from "@/i18n/config";
import { swapLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export type LanguageSwitcherProps = {
  /** Locale of the page currently being rendered. */
  currentLocale: Locale;
  /** Translated label, e.g. "Language" / "Bahasa". */
  label: string;
  className?: string;
};

/**
 * Client-side language switcher.
 *
 * It keeps the user on the same page: only the leading `[lang]` segment is
 * swapped, the rest of the path and the query string are preserved.
 *
 * The choice is also written to a cookie so the proxy negotiates the same
 * language on the next bare visit to `/`.
 */
export function LanguageSwitcher({ currentLocale, label, className }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  function handleValueChange(nextLocale: string) {
    if (!locales.includes(nextLocale as Locale) || nextLocale === currentLocale) {
      return;
    }

    const target = swapLocale(pathname, nextLocale as Locale);

    // Remember the explicit choice for the proxy's Accept-Language negotiation.
    document.cookie = `${localeCookieName}=${nextLocale};path=/;max-age=${ONE_YEAR_IN_SECONDS};samesite=lax`;

    startTransition(() => {
      // `window.location.search` avoids `useSearchParams()`, which would force
      // every page that renders the header out of static rendering.
      router.replace(`${target}${window.location.search}`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-2", className)}
          aria-label={label}
          disabled={isPending}
        >
          <Languages className="size-4" />
          <span className="hidden sm:inline">{localeMeta[currentLocale].nativeLabel}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentLocale} onValueChange={handleValueChange}>
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              <span aria-hidden className="me-1">
                {localeMeta[locale].flag}
              </span>
              {localeMeta[locale].nativeLabel}
              <span className="text-muted-foreground ms-auto text-xs">{locale.toUpperCase()}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
