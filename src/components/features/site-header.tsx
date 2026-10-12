import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import type { Dictionary } from "@/dictionaries";
import { LanguageSwitcher } from "@/components/features/language-switcher";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/locale";
import { routes } from "@/lib/routes";

export type SiteHeaderProps = {
  lang: Locale;
  dict: Dictionary;
};

/**
 * Server Component. Reads only the dictionary, so it adds **zero** client
 * JavaScript beyond the two switchers.
 *
 * Note: deliberately not auth-aware. Reading the session here would opt every
 * page out of static rendering. Add a small client `UserButton` (subscribing to
 * `onAuthStateChange`) if you need an avatar in the header.
 */
export function SiteHeader({ lang, dict }: SiteHeaderProps) {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6">
        <Link
          href={localizedPath(lang, routes.home)}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
            7
          </span>
          <span>{dict.common.appName}</span>
        </Link>

        <nav aria-label={dict.nav.home} className="ms-4 hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href={localizedPath(lang, routes.home)}>{dict.nav.home}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={localizedPath(lang, routes.dashboard)}>
              <LayoutDashboard className="size-4" />
              {dict.nav.dashboard}
            </Link>
          </Button>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher currentLocale={lang} label={dict.common.language} />
          <ThemeToggle
            labels={{
              theme: dict.common.theme,
              light: dict.common.themeLight,
              dark: dict.common.themeDark,
              system: dict.common.themeSystem,
            }}
          />
          <Button asChild variant="outline" size="sm" className="ms-1">
            <Link href={localizedPath(lang, routes.login)}>{dict.nav.signIn}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
