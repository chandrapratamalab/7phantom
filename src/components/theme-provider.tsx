"use client";

import * as React from "react";
import { useServerInsertedHTML } from "next/navigation";

/**
 * Theme provider — light / dark / system.
 * -----------------------------------------------------------------------------
 * This is a small, dependency-free replacement for `next-themes`.
 *
 * WHY IT EXISTS
 * `next-themes@0.4.6` renders its no-flash inline `<script>` through
 * `React.createElement("script", …)` *inside the provider*. React 19.2+ rejects
 * client-rendered `<script>` elements ("Encountered a script tag while rendering
 * React component"), and because our root layout lives inside the dynamic
 * `[lang]` segment, switching language remounts the provider and re-creates that
 * script — so the error fired on every locale change.
 *
 * THE FIX
 * The no-flash script is injected with `useServerInsertedHTML`, which flows only
 * into the server-rendered HTML stream and never into the RSC payload. The
 * browser therefore receives a plain `<script>` in the initial HTML (it runs
 * before first paint, so there is no flash) and React never creates a `<script>`
 * element on the client — even across remounts.
 *
 * The choice lives in a tiny external store read through `useSyncExternalStore`,
 * which is the supported way to read browser state without `useEffect` +
 * `setState` (and avoids hydration mismatches).
 *
 * Theming is class-based: `<html class="light|dark">`, matching
 * `@custom-variant dark (&:is(.dark *))` and `darkMode: "class"`. `<html>` keeps
 * `suppressHydrationWarning` because that class is written by the injected
 * script, not by React.
 */

/** `localStorage` key that persists the visitor's choice. */
export const THEME_STORAGE_KEY = "theme";

/** Themes that map directly to a CSS class / `color-scheme`. */
const COLOR_SCHEMES = ["light", "dark"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

/** The visitor's choice: an explicit scheme, or follow the OS. */
export type Theme = ColorScheme | "system";

export type ThemeContextValue = {
  /** The visitor's choice — `"light"`, `"dark"` or `"system"`. */
  theme: Theme;
  /** Change the choice and persist it to `localStorage`. */
  setTheme: (theme: Theme) => void;
  /** The scheme actually applied to `<html>` (system resolved to light/dark). */
  resolvedTheme: ColorScheme;
  /** Current OS preference, or `undefined` when system support is disabled. */
  systemTheme: ColorScheme | undefined;
  /** Every selectable theme, in display order. */
  themes: Theme[];
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be called inside <ThemeProvider>.");
  }

  return context;
}

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(storageKey: string): Theme | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return isTheme(value) ? value : null;
  } catch {
    // Storage can be blocked (private mode); fall back to the default.
    return null;
  }
}

/**
 * Builds the inline script that runs before first paint.
 *
 * Kept as a string so it can be injected via `dangerouslySetInnerHTML` on the
 * server. It only reads `localStorage`/`matchMedia` and toggles classes — never
 * user input — so there is nothing to escape.
 */
function buildThemeScript(storageKey: string, defaultTheme: Theme, enableSystem: boolean) {
  const resolveSystem = enableSystem
    ? `if(theme==="system"){theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}`
    : `if(theme==="system"){theme="light"}`;

  return `(function(){try{
var root=document.documentElement;
var stored=null;
try{stored=localStorage.getItem(${JSON.stringify(storageKey)})}catch(e){}
var theme=stored||${JSON.stringify(defaultTheme)};
${resolveSystem}
root.classList.remove("light","dark");
root.classList.add(theme);
root.style.colorScheme=theme;
}catch(e){}})();`;
}

/** The snapshot React renders from: the choice plus the current OS preference. */
type ThemeSnapshot = {
  theme: Theme;
  systemTheme: ColorScheme;
};

/** Fires when this tab changes the theme (`storage` events don't reach this tab). */
const THEME_CHANGE_EVENT = "themechange";

type ThemeStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => ThemeSnapshot;
  getServerSnapshot: () => ThemeSnapshot;
  setTheme: (theme: Theme) => void;
};

type ThemeStoreOptions = {
  storageKey: string;
  fallbackTheme: Theme;
  enableSystem: boolean;
};

/**
 * Small external store over `localStorage` + `matchMedia`.
 *
 * `getSnapshot` must return a referentially-stable value while nothing changes,
 * so the result is cached and only rebuilt when the underlying values differ.
 */
function createThemeStore({
  storageKey,
  fallbackTheme,
  enableSystem,
}: ThemeStoreOptions): ThemeStore {
  let clientCache: { key: string; value: ThemeSnapshot } | null = null;
  const serverSnapshot: ThemeSnapshot = { theme: fallbackTheme, systemTheme: "light" };

  const readSystemTheme = (): ColorScheme =>
    enableSystem && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const getSnapshot = (): ThemeSnapshot => {
    const theme = readStoredTheme(storageKey) ?? fallbackTheme;
    const systemTheme = readSystemTheme();
    const key = `${theme}:${systemTheme}`;

    if (!clientCache || clientCache.key !== key) {
      clientCache = { key, value: { theme, systemTheme } };
    }

    return clientCache.value;
  };

  const subscribe = (onStoreChange: () => void) => {
    const media = enableSystem ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    media?.addEventListener("change", onStoreChange);
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

    return () => {
      media?.removeEventListener("change", onStoreChange);
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    };
  };

  const setTheme = (next: Theme) => {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Not persisted, but the in-memory choice will still apply.
    }

    // The `storage` event does not fire in the tab that made the change.
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return { subscribe, getSnapshot, getServerSnapshot: () => serverSnapshot, setTheme };
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  /** Initial theme. Defaults to `"system"` (or `"light"` when system is disabled). */
  defaultTheme?: Theme;
  /** `localStorage` key used to persist the choice. */
  storageKey?: string;
  /** When `false`, `"system"` is not offered and the OS preference is ignored. */
  enableSystem?: boolean;
  /** Disable CSS transitions for a tick around a theme change (avoids smearing). */
  disableTransitionOnChange?: boolean;
};

export function ThemeProvider({
  children,
  defaultTheme,
  storageKey = THEME_STORAGE_KEY,
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const fallbackTheme = React.useMemo<Theme>(
    () => defaultTheme ?? (enableSystem ? "system" : "light"),
    [defaultTheme, enableSystem],
  );

  const store = React.useMemo(
    () => createThemeStore({ storageKey, fallbackTheme, enableSystem }),
    [storageKey, fallbackTheme, enableSystem],
  );

  const { theme, systemTheme } = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const resolvedTheme: ColorScheme = theme === "system" ? systemTheme : theme;

  // Inject the no-flash script into the server HTML (never the client tree).
  useServerInsertedHTML(() => (
    <script
      dangerouslySetInnerHTML={{
        __html: buildThemeScript(storageKey, fallbackTheme, enableSystem),
      }}
    />
  ));

  // Apply the resolved scheme to <html>. This only writes to an external system
  // (the DOM), so it does not trigger React state updates.
  React.useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      root.classList.remove(...COLOR_SCHEMES);
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
    };

    if (!disableTransitionOnChange) {
      apply();
      return;
    }

    const style = document.createElement("style");
    style.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important}"));
    document.head.appendChild(style);

    apply();
    // Reading layout forces the browser to commit the change before we restore
    // transitions (a synchronous reflow).
    root.getBoundingClientRect();

    const timeout = window.setTimeout(() => style.remove(), 1);
    return () => {
      window.clearTimeout(timeout);
      style.remove();
    };
  }, [resolvedTheme, disableTransitionOnChange]);

  const themes = React.useMemo<Theme[]>(
    () => (enableSystem ? ["light", "dark", "system"] : ["light", "dark"]),
    [enableSystem],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: store.setTheme,
      resolvedTheme,
      systemTheme: enableSystem ? systemTheme : undefined,
      themes,
    }),
    [theme, store, resolvedTheme, systemTheme, enableSystem, themes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
