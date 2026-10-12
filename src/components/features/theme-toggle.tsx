"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
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

export type ThemeToggleLabels = {
  theme: string;
  light: string;
  dark: string;
  system: string;
};

const THEMES = ["light", "dark", "system"] as const;

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const emptySubscribe = () => () => {};

/**
 * `false` while rendering on the server / before hydration, `true` afterwards.
 * Preferred over `useState` + `useEffect(() => setMounted(true))`, which causes
 * a cascading render and is flagged by the `react-hooks` lint rules.
 */
function useHydrated() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle({ labels }: { labels: ThemeToggleLabels }) {
  const { theme, setTheme } = useTheme();

  // The server has no idea which theme the user picked, so we deliberately
  // render "no selection" until after hydration to avoid a mismatch.
  const mounted = useHydrated();

  function handleThemeChange(value: string) {
    if (value === "light" || value === "dark" || value === "system") {
      setTheme(value);
    }
  }

  const options = THEMES.map((value) => ({
    value,
    label: labels[value === "light" ? "light" : value === "dark" ? "dark" : "system"],
    Icon: ICONS[value],
  }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={labels.theme}>
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">{labels.theme}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{labels.theme}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mounted ? theme : undefined}
          onValueChange={handleThemeChange}
        >
          {options.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
