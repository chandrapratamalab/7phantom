# Architecture guide

This is the reference for how the foundation is put together and the rules to follow
when adding features. Read it before writing code — most of it is about **where code
belongs**, not about clever abstractions.

- [1. Mental model](#1-mental-model)
- [2. Directory responsibilities](#2-directory-responsibilities)
- [3. Rendering: RSC vs Client Components](#3-rendering-rsc-vs-client-components)
- [4. Internationalization](#4-internationalization)
- [5. Supabase: which client, when](#5-supabase-which-client-when)
- [6. Security](#6-security)
- [7. Database & RLS conventions](#7-database--rls-conventions)
- [8. Styling & design system](#8-styling--design-system)
- [9. Recipes](#9-recipes)
- [10. Quality gates](#10-quality-gates)
- [11. Deployment](#11-deployment)

---

## 1. Mental model

Three ideas explain almost every decision in this repo:

1. **The server is the default.** Pages, data access and mutations live on the server.
   The browser receives HTML and a small amount of JavaScript for genuinely
   interactive pieces. Client JavaScript is a deliberate exception, not the baseline.

2. **There are exactly three trust boundaries**, and each has one enforcement point:

   | Boundary                     | Enforced by                                              |
   | ---------------------------- | -------------------------------------------------------- |
   | Browser ↔ server             | Zod validation + session re-verification in every action |
   | App ↔ database               | Row Level Security policies in Postgres                  |
   | Public ↔ private environment | `server-only` module separation (`src/lib/env/*`)        |

3. **The URL is the source of truth for language.** `/[lang]/…` makes the locale an
   explicit, shareable part of every route, and the proxy is the only place that
   decides which locale an un-prefixed request should get.

```
request
  └─ src/proxy.ts ─ refresh session ─ ensure locale prefix ─ gate protected routes
        └─ src/app/[lang]/layout.tsx ─ <html lang dir> ─ fonts ─ header ─ toaster
              ├─ page.tsx          (Server Component, reads dictionary + data)
              ├─ login/page.tsx    (Server Component shell → Client form)
              └─ dashboard/page.tsx(requireUser → RLS-scoped query)
```

---

## 2. Directory responsibilities

| Path                        | May contain                                          | Must never contain                             |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `src/proxy.ts`              | Route interception, redirects, session refresh       | Business logic, data fetching for rendering    |
| `src/app/[lang]/*`          | Server Components, route metadata, layouts           | Heavy client logic inline                      |
| `src/app/api/*`             | Route handlers (bearer-token / webhook entry points) | Cookie-session-dependent UI                    |
| `src/actions/*`             | `"use server"` async functions only                  | Types/constants (move them to `src/lib`)       |
| `src/lib/auth/dal.ts`       | Authorization + user lookup helpers (`server-only`)  | UI concerns                                    |
| `src/lib/validations/*`     | Zod schemas (as factories)                           | Direct DB access                               |
| `src/lib/env/*`             | Environment parsing (`client.ts`, `server.ts`)       | Anything importing `next/*`                    |
| `src/lib/routes.ts`         | Route map, protection list, safe-redirect helper     | React/JSX                                      |
| `src/utils/supabase/*`      | Client factories (browser/server/admin/middleware)   | Feature logic                                  |
| `src/components/ui/*`       | shadcn/ui primitives (generated, lightly customised) | App-specific business logic                    |
| `src/components/features/*` | App components (header, forms, switchers)            | Direct `@supabase/*` imports (use the utils)   |
| `src/dictionaries/*`        | JSON translations + typed loader (`server-only`)     | Secrets, HTML                                  |
| `src/i18n/*`                | Locale config, negotiation, path + format helpers    | `server-only` imports (shared with the client) |
| `supabase/migrations/*`     | Ordered SQL migrations                               | Manual, out-of-band schema edits               |

### The `"use server"` export rule

A `"use server"` module **may only export async functions**. That is why
`AuthActionState` and `initialAuthActionState` live in
`src/lib/auth/action-state.ts` and are imported by the actions module, rather than
being defined there. When you add actions, follow the same split:

```
src/lib/<feature>/action-state.ts   # types + initial values (plain module)
src/actions/<feature>.ts            # "use server", async functions only
```

---

## 3. Rendering: RSC vs Client Components

### The decision rule

Start with a **Server Component**. Add `"use client"` only when the component needs
one of these:

- React state or refs (`useState`, `useReducer`, `useRef`)
- Effects / lifecycle (`useEffect`, `useLayoutEffect`)
- Browser-only APIs (`window`, `document`, `localStorage`, `matchMedia`)
- Event handlers that talk to the client (`onClick`, `onChange`, …)
- Client-side libraries (a chart renderer, a drag-and-drop engine, a carousel)

Keep the client boundary **at the leaves**. A page should be a Server Component that
renders small Client Components, not a Client Component that fetches on mount.

### How the foundation applies it

| Component                                       | Kind       | Why                                                        |
| ----------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `src/app/[lang]/layout.tsx`                     | Server     | HTML shell, fonts, dictionary, zero interactivity          |
| `src/app/[lang]/page.tsx`                       | Server     | Reads dictionary, renders static markup                    |
| `src/app/[lang]/dashboard/page.tsx`             | Server     | `requireUser()` + DB read through RLS                      |
| `src/components/features/site-header.tsx`       | Server     | Pure markup + dictionary; renders the two client switchers |
| `src/components/features/language-switcher.tsx` | **Client** | Uses `useRouter`/`usePathname`/`useTransition`             |
| `src/components/features/theme-toggle.tsx`      | **Client** | Reads `useTheme()` + dropdown state                        |
| `src/components/theme-provider.tsx`             | **Client** | Theme context + server-injected no-FOUC script             |
| `src/components/features/login-form.tsx`        | **Client** | `useActionState`, toggling sign-in/sign-up                 |

### Deliberate non-decisions

- **The header is not auth-aware.** Reading the session in `SiteHeader` would opt
  every page out of static rendering (`cookies()` is dynamic). If you need an avatar
  in the header later, add a small client `UserButton` that subscribes to
  `supabase.auth.onAuthStateChange`.
- **`not-found.tsx` does not receive route `params`.** Next.js gives boundaries no
  route context, so a localized 404 can't know the language. It renders the message
  in every supported language instead of guessing (see §4).
- **`typedRoutes` is off** in `next.config.ts`. Hrefs are built at runtime from the
  active locale (`localizedPath(lang, …)`), which `Route` typing can't express without
  casts. Flip it on once the route surface is stable.

### Data fetching

- **Read in Server Components** — call the DAL or a Supabase `server` client query
  directly. There is no `useEffect` fetch and no API round-trip for page data.
- **Write in Server Actions** — forms post to an action (`useActionState`), which
  validates, mutates, `revalidatePath`s and redirects.
- **Route Handlers are for non-UI entry points** — bearer-token APIs, webhooks, and
  the OAuth/PKCE callback. Auth pages use the cookie session instead.

Wrap slow sections in `<Suspense>` with a `loading.tsx` sibling, and put
`error.tsx` boundaries next to the pages that can fail.

---

## 4. Internationalization

### Configuration is the single source of truth

`src/i18n/config.ts` lists the locales and their metadata. Everything else derives
from it:

```ts
export const locales = ["en", "id"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookieName = "NEXT_LOCALE";

export const localeMeta: Record<Locale, LocaleMeta> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr", flag: "🇬🇧" },
  id: { label: "Indonesian", nativeLabel: "Bahasa Indonesia", dir: "ltr", flag: "🇮🇩" },
};
```

This module must stay free of `server-only` imports — the client language switcher
reads it.

### Routes

The entire app lives under `src/app/[lang]/`. The layout validates `lang` with
`isLocale()` (the authoritative guard — the proxy only redirects) and renders
`<html lang={lang} dir={localeMeta[lang].dir}>`. Anything rendered underneath —
`loading`, `not-found`, error boundaries — inherits the correct language context.

Paths are stored **without** a locale prefix in `src/lib/routes.ts`, and hrefs are
built with helpers from `src/i18n/locale.ts`:

```ts
localizedPath("id", "/dashboard"); // "/id/dashboard"
stripLocale("/id/dashboard"); // { locale: "id", pathname: "/dashboard" }
swapLocale("/en/dashboard", "id"); // "/id/dashboard"
localeAlternates("/"); // { en: "/en", id: "/id" }  → hreflang
```

**Never hand-concatenate a locale prefix.** Always go through the helpers so the
route map stays the only place paths are spelled out.

### Dictionaries

Dictionaries are typed, lazy JSON with a reference-locale shape:

```ts
// src/dictionaries/index.ts  (server-only)
import type en from "./en.json";
export type Dictionary = typeof en; // shape = en.json

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./en.json").then((m) => m.default),
  id: () => import("./id.json").then((m) => m.default),
};
export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
```

Why it's built this way:

- **`import type`** erases at build time — deriving the shape from `en.json` costs
  nothing at runtime and keeps dictionaries lazy (each language is its own chunk).
- **`Record<Locale, () => …>`** forces a loader per locale: registering a locale
  without a dictionary is a compile error.
- **`Dictionary = typeof en`** means every other locale must have identical keys. A
  missing translation is a TypeScript error, not a runtime `undefined`.
- **`server-only`** guarantees a dictionary can never drag server dependencies into
  the client bundle. Client Components receive translated strings as props.

`src/i18n/format.ts` provides `interpolate("Hi {email}", { email })` for simple
placeholder substitution. It is deliberately not ICU — swap in `intl-messageformat`
if the PRD needs plurals/gender.

### Locale negotiation

`negotiateLocale()` in `src/i18n/locale.ts` is a hand-rolled RFC 9110 parser with no
dependencies (no `negotiator`, no `@formatjs/intl-localematcher`). Priority:

1. Explicit `NEXT_LOCALE` cookie (set by the language switcher) — the user's choice wins.
2. `Accept-Language` header (region subtags collapse: `id-ID` → `id`).
3. `defaultLocale`.

The proxy applies this to **un-prefixed** requests and redirects to the negotiated
locale; it also writes the cookie back when a request already carries a locale prefix,
so a later bare visit to `/` remembers the choice.

### The language switcher

`LanguageSwitcher` is a Client Component that swaps **only** the leading segment via
`swapLocale(pathname, next)` and preserves the query string with
`window.location.search` (using `useSearchParams()` would force every page rendering
the header out of static rendering). It writes `NEXT_LOCALE` and calls
`router.replace()` inside a transition.

### Adding a language

1. Add the code to `locales` and an entry to `localeMeta` in `src/i18n/config.ts`.
2. Add `src/dictionaries/<locale>.json` (copy `en.json`; missing keys fail typecheck).
3. Register the loader in `src/dictionaries/index.ts`.

That's it — `generateStaticParams` in the layout prerenders the new tree, the
switcher lists it automatically, and hreflang alternates include it.

### 404s

`src/app/[lang]/not-found.tsx` receives no `params`, so it renders the message in
**every** supported language, each tagged with its own `lang` attribute so screen
readers switch voice correctly.

---

## 5. Supabase: which client, when

There are four client factories. Picking the wrong one is the most common mistake —
especially reaching for the admin client.

| Factory                       | Runtime              | Identity       | RLS     | Use for                                               |
| ----------------------------- | -------------------- | -------------- | ------- | ----------------------------------------------------- |
| `@/utils/supabase/client`     | Browser              | Signed-in user | on      | Realtime, storage uploads from the client             |
| `@/utils/supabase/server`     | Server (per request) | Signed-in user | on      | Server Components, Server Actions, route handlers     |
| `@/utils/supabase/admin`      | **Server only**      | Service role   | **off** | Admin jobs, cron, privileged webhooks, `auth.admin.*` |
| `@/utils/supabase/middleware` | `src/proxy.ts`       | Signed-in user | on      | Refreshing the session per request                    |

### `server` — the default for app code

```ts
import { createClient } from "@/utils/supabase/server";

const supabase = await createClient();
const { data } = await supabase.from("notes").select("*"); // RLS scopes rows
```

It **must** be created per request (never hoisted to a module variable): with
streaming/fluid compute a shared instance would leak one user's cookies into another
user's request. `setAll` is wrapped in a `try/catch` because Server Components cannot
set cookies — the proxy handles the refresh instead.

### `admin` — privileged, and treated as dangerous

`createAdminClient()` bypasses RLS. Defence in depth:

1. `import "server-only"` — the build fails if a Client Component imports it.
2. The key is read via `getServerEnv()`, never `process.env` directly.
3. Session persistence is off — it is stateless and never carries user cookies.

Legitimate uses: admin dashboards, background/cron jobs, privileged webhooks,
`auth.admin.*`. **For everything else, use `server`.**

### `middleware` — session refresh

Server Components can't write cookies, so without a refresh step an expired access
token would never rotate and users would be logged out at random. `updateSession()`
runs on every request, calls `supabase.auth.getClaims()` (JWKS-verified, no
per-request network hop), and returns a response already carrying the rotated
`Set-Cookie` headers.

Two rules from Supabase's docs are encoded here:

- Don't run logic **between** `createServerClient(...)` and `getClaims()`.
- Call `getClaims()` **before** you start building a response, or a late refresh is
  dropped.

`inheritSession(target, session)` copies rotated cookies + `Cache-Control: private,
no-store` onto any response you return _instead_ of the refresh response (a locale or
auth redirect). **Skipping this is the documented cause of "users randomly logged
out."**

### Auth flow

```
Sign up (Server Action)
  supabase.auth.signUp({ email, password, options: { data: { full_name, locale },
                            emailRedirectTo: `${SITE_URL}/auth/callback?next=…` } })
        │
        ├─ email confirmation ON  → return { status: "success", message: checkEmail }
        └─ confirmation OFF       → revalidatePath + redirect to dashboard

Confirm email / magic link / OAuth
  GET /auth/callback?code=…&next=…        (excluded from the proxy matcher)
        → supabase.auth.exchangeCodeForSession(code)
        → redirect to a validated same-origin `next` (else localized dashboard)

Every subsequent request
  proxy → updateSession(): getClaims() verifies + refreshes → cookies inherited

Sign out (Server Action)
  supabase.auth.signOut() → revalidatePath → redirect home
```

### Route handlers & bearer tokens

`/api/me` shows the stateless pattern for mobile apps, CLIs and MCP clients: verify
an `Authorization: Bearer <access_token>` locally against the project JWKS
(`verifySupabaseJwt` in `src/lib/auth/verify-token.ts`), with **no** session cookie
and **no** Auth round-trip. `createRemoteJWKSet` caches the key set, so the hot path
stays fast. API routes are excluded from the proxy matcher.

---

## 6. Security

### Preventing `SUPABASE_SECRET_KEY` leakage

This is the single most important invariant. Four independent layers enforce it:

1. **Separate modules.** Public env lives in `src/lib/env/client.ts`; private env in
   `src/lib/env/server.ts`. There is no single `env.ts` that mixes them.
2. **`server-only`.** `src/lib/env/server.ts`, `src/utils/supabase/admin.ts`,
   `src/lib/auth/dal.ts` and `src/dictionaries/index.ts` all `import "server-only"`.
   If a Client Component transitively imports one, **the build fails** — you cannot
   ship the leak.
3. **Indirection.** Private values are read through `getServerEnv()`, never
   `process.env.SUPABASE_SECRET_KEY` inline, so the reference only ever exists in a
   server-only module.
4. **RLS is the real guard.** The publishable key is designed to be public. Even if it
   leaks, Row Level Security decides what any token can read or write. Never treat
   key secrecy as the access control.

Lazy validation is deliberate: `next build` evaluates the module graph of every route
to collect metadata, so parsing at import time would break the build on a fresh clone.
Public env is parsed on first read (`env.NEXT_PUBLIC_SUPABASE_URL` getters); private env
on first `getServerEnv()` call.

### Server Action security

Treat every Server Action exactly like a public API endpoint. The contract, in order
(see `src/actions/auth.ts`):

1. **Resolve the caller's locale** — from the hidden `lang` field (actions have no
   access to the URL).
2. **Validate with Zod** — never trust `FormData`. Schemas are factories that accept
   translated messages, so validation lives in `src/lib/validations/*` while errors
   render in the visitor's language.
3. **Re-verify authorization** — call `requireUser(locale)` / `getCurrentUser()`
   before touching private data. The proxy gate is only a UX optimisation; an action
   is an independent entry point.
4. **`revalidatePath` then `redirect`.**

Additional rules baked in:

- **Generic auth errors.** Sign-in returns one vague "invalid credentials" message —
  never reveal whether an email exists.
- **Normalise identity.** Emails are trimmed and lower-cased so casing can't create
  duplicate accounts.
- **No open redirects.** `safeRedirectPath()` only allows same-origin absolute paths
  (rejects `//`, backslashes, non-`/` values). Applied to `?next=` on the login page,
  in the sign-in action, and in the auth callback.
- **Hard errors.** `react-hooks/rules-of-hooks` is an error in `eslint.config.mjs` so a
  non-async export in a `"use server"` file can't slip through.

### Identity: cheap vs authoritative

`src/lib/auth/dal.ts` exposes two levels on purpose:

| Helper             | What it does                        | Use for                                      |
| ------------------ | ----------------------------------- | -------------------------------------------- |
| `getClaims()`      | JWKS-verified JWT claims (local)    | **UI decisions** (show/hide a button)        |
| `getCurrentUser()` | `auth.getUser()` — server-validated | **Authorization**                            |
| `requireUser()`    | `getCurrentUser()` + redirect       | Top of any page/action exposing private data |

Both are wrapped in React `cache()`, so they run at most once per render pass. Never
base authorization on `getClaims()`.

### Baseline hardening

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`
and a restrictive `Permissions-Policy`. A full `Content-Security-Policy` is left for
the PRD, since it depends on the third parties you introduce (fonts, analytics,
storage domains).

---

## 7. Database & RLS conventions

The initial migration (`supabase/migrations/20260101000000_init.sql`) is the template.
Follow its conventions for every new table.

### Table shape

```sql
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- Every tenant-owned row carries `user_id uuid references auth.users(id) on delete
cascade`.
- Constraints live in the schema (`check`, `not null`) — don't rely only on app code.
- `created_at` / `updated_at` are `timestamptz not null default now()`.
- Index the FK, plus the columns your main listing sorts/filters on
  (`notes_user_id_created_at_idx`).

### RLS

```sql
alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notes_insert_own" on public.notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "notes_update_own" on public.notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes_delete_own" on public.notes for delete to authenticated
  using ((select auth.uid()) = user_id);
```

Rules:

- **Enable RLS on every table.** A table without it is readable by the publishable key.
- **Name policies `<table>_<op>_<rule>`** and write one per operation you actually
  support (`for select/insert/update/delete`), scoped `to authenticated`.
- **Wrap `auth.uid()` in a sub-select** — `(select auth.uid())` — so Postgres evaluates
  it once (initplan) instead of once per row. This is a large win on big scans. Policies
  are `drop policy if exists` before `create` so migrations are re-runnable.

Because the policy scopes rows, the app queries **without** `where user_id = …`:

```ts
const { data } = await supabase.from("notes").select("*"); // already own rows only
```

### Triggers & functions

- `updated_at` is maintained by the `set_updated_at` trigger, never by the client.
- `handle_new_user` (security definer) creates the `profiles` row after sign-up,
  reading `full_name` / `locale` from `raw_user_meta_data` (set by `signUpAction`).
- Any `security definer` function **pins `set search_path = ''`** to prevent privilege
  escalation via schema shadowing, and fully-qualifies its identifiers.

### Migrations workflow

```bash
# Hosted project
npm run supabase:login          # once per machine (else `link` says "not logged in")
npm run supabase:link -- --project-ref <ref>
npm run db:remote:push          # apply supabase/migrations/* to the linked project
npm run db:remote:types         # regenerate src/utils/supabase/types.ts

# Local stack (Docker must be running)
npm run supabase:start          # start the stack, prints local URL + keys
npm run db:local:push           # apply NEW migrations only (keeps local data)
npm run db:local:reset          # clean slate: re-run every migration + seed.sql
npm run db:local:types          # regenerate types from the local DB
```

- Migrations are append-only and timestamped. Never edit an applied migration — add
  a new one.
- `db:local:push` (`supabase migration up`) applies only pending migrations and **keeps
  local data**; `db:local:reset` rebuilds the database and runs `seed.sql`. Reset only
  after rewriting migration history — ordinary changes just need a `push`.
- `supabase/seed.sql` runs only on a local reset (never against hosted). It seeds one
  confirmed demo user — `demo@example.com` / `password123` — plus two `notes`, using
  fixed ids and `on conflict` so it is idempotent. Because it inserts into `auth.users`,
  it also writes the matching `auth.identities` row required by `signInWithPassword`.
- Local infrastructure lives in `supabase/config.toml`; change ports there if they
  clash with something already running, then `supabase:stop` + `supabase:start`.
- Regenerate `types.ts` after every schema change so queries are type-checked;
  `supabase.from("notes").select("titel")` becomes a compile error.

---

## 8. Styling & design system

### Tailwind v4 is CSS-first

The design system lives in **`src/app/globals.css`**, not in a JS config:

```css
@import "tailwindcss";
@import "tw-animate-css";
@config "../../tailwind.config.ts";      /* legacy shim: fonts/radii/container only */
@custom-variant dark (&:is(.dark *));    /* class-based dark mode (theme provider) */

@theme inline {                          /* CSS variable → Tailwind utility name */
  --color-primary: var(--primary);       /* → bg-primary, text-primary, border-primary */
  --radius-lg: var(--radius);
  …
}

:root { --primary: oklch(0.205 0 0); … } /* light tokens */
.dark { --primary: oklch(0.922 0 0); … } /* dark tokens  */
```

Key facts:

- **`@theme inline` resolves values at use-site.** Do **not** expect `--color-primary`
  to appear in the emitted CSS — `bg-primary` compiles to `var(--primary)`. That is
  correct and required for runtime theming.
- **`@custom-variant dark`** mirrors `darkMode: "class"` in `tailwind.config.ts`, so
  the theme provider toggling `.dark` on `<html>` swaps every token.
- **`tailwind.config.ts` is a deliberate shim** for the three things still nicer in
  config-land (font family variables, the radius scale, the container). It is loaded
  via `@config`. **Never re-declare colors there** — colors are CSS variables so they
  can be themed/swapped at runtime.
- `postcss.config.mjs` uses only `@tailwindcss/postcss`.

### Tokens

Tokens are OKLCH for perceptually-even lightness, cover `background/foreground`,
`card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`,
`success`, `warning`, `border`, `input`, `ring`, `chart-1..5` and a full `sidebar`
set. **Rebrand by editing `--primary`** (and friends) in `:root`/`.dark` — every
button, badge and link follows.

To add a token: define it in `:root` **and** `.dark`, then map it in `@theme inline`
as `--color-<name>`. It immediately becomes a utility.

### Base layer & utilities

`@layer base` applies the border/outline defaults, `bg-background text-foreground`,
an `:lang(id)` typography hook, and a `prefers-reduced-motion` reset. Composite
utilities use the v4 `@utility` directive (`text-balance`, `text-pretty`) — the v3
`@layer components` pattern is gone.

### shadcn/ui

Components are generated with the CLI (see README) and live in
`src/components/ui/`. `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge), so
callers can always override a component's classes. `components.json` sets
`style: "new-york"`, `baseColor: "neutral"`, `cssVariables: true`, and maps the
Supabase registry as `@supabase`.

Use CSS variable utilities (`bg-primary`, `text-muted-foreground`, `border-border`) in
your own components rather than raw colors, so light/dark and rebrands are free.

### Theming

`src/components/theme-provider.tsx` is a small, dependency-free provider
(`ThemeProvider` + `useTheme`) that owns the light/dark/system choice. Consumers:
`theme-toggle.tsx` (the switcher) and `ui/sonner.tsx` (toast theming).

It handles persistence (`localStorage`), OS preference (`matchMedia`), cross-tab sync
(`storage` events) and `disableTransitionOnChange`, and applies the resolved scheme as
a class on `<html>` (`light`/`dark`) together with `style.colorScheme`.

**Why not `next-themes`?** `next-themes@0.4.6` (latest, unmaintained since Mar 2025)
renders its no-flash `<script>` from a React component. React 19.2+ rejects
client-rendered script tags, and because the root layout lives in the dynamic `[lang]`
segment, switching language remounts the provider and re-creates that script — so the
error fired on every locale change.

Instead, the no-flash script is injected with **`useServerInsertedHTML`**
(`next/navigation`), whose output flows only into the server HTML stream and never the
RSC payload. The browser gets a synchronous `<script>` before first paint (no flash),
and React never creates a `<script>` element on the client — even across remounts.

`<html>` keeps `suppressHydrationWarning` because the class is written imperatively by
that script, not by React. If you adopt a CSP with a `nonce`, thread it into the
injected script.

---

## 9. Recipes

### Add a page

1. Create `src/app/[lang]/<segment>/page.tsx` as a Server Component.
2. Add the path to `src/lib/routes.ts` (`routes.<name> = "/<segment>"`).
3. Read the dictionary: `const dict = await getDictionary(lang)`.
4. Add the strings under a namespace in **both** `en.json` and `id.json`.
5. Link with `localizedPath(lang, routes.<name>)`.
6. If it's private, add its prefix to `protectedRoutePrefixes` **and** call
   `requireUser(lang)` at the top of the page.

### Add a protected feature (action + DAL + page)

```
src/lib/validations/<feature>.ts   # createXSchema(messages) — Zod factory
src/lib/<feature>/action-state.ts  # ActionState type + initial value (plain module)
src/actions/<feature>.ts           # "use server"; createXAction(prev, formData)
src/app/[lang]/<feature>/page.tsx  # requireUser → RLS-scoped read → render
```

Action skeleton (mirror `src/actions/auth.ts`):

```ts
"use server";
export async function createNoteAction(
  _prev: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const locale = readLocale(formData);              // 1. translate + locale
  const dict = await getDictionary(locale);
  const parsed = createNoteSchema({ title: dict.validation.title }).safeParse({ title: … });
  if (!parsed.success) return { status: "error", fieldErrors: … };   // 2. validate
  const user = await requireUser(locale);           // 3. re-authorize
  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ user_id: user.id, … });
  if (error) return { status: "error", message: dict.<feature>.errors.unknown };
  revalidatePath(localizedPath(locale, routes.<feature>));           // 4. refresh
  return { status: "success", message: dict.<feature>.created };     // (or redirect)
}
```

Client side: `const [state, formAction, pending] = useActionState(action, initialState)`
and a `type="hidden" name="lang" value={lang}` field, exactly like `LoginForm`.

### Add a table

1. New migration: `supabase/migrations/<timestamp>_<name>.sql`.
2. Follow §7 — `user_id` FK, constraints, indexes, `enable row level security`, named
   policies with `(select auth.uid())`, `updated_at` trigger.
3. Apply it with `npm run db:remote:push` (hosted) or `npm run db:local:push`
   (local, keeps data), then regenerate types (`db:remote:types` or `db:local:types`).
4. Query through `@/utils/supabase/server`; let RLS scope the rows.

### Add an environment variable

- **Public?** Add it to `clientEnvSchema` in `src/lib/env/client.ts`, expose a getter
  on `env`, and add it to `.env.example` + the README table.
- **Private?** Add it to `serverEnvSchema` in `src/lib/env/server.ts` and document it.
- Prefix only genuinely public values with `NEXT_PUBLIC_`. If in doubt, make it private.

---

## 10. Quality gates

Run all of these before committing:

```bash
npx next typegen      # generate route types (needed for typed route helpers)
npx tsc --noEmit      # type check
npm run lint          # ESLint
npm run build         # production build
```

The build must pass **without** a `.env.local` on a fresh clone (lazy env validation).
Generated CSS should contain a `:root` token block, a `.dark{…}` override block, and
the `--font-geist-sans` / `--font-geist-mono` variables. `supabase types.ts` is
excluded from lint (generated).

Style is enforced by Prettier (`.prettierrc.json`, `prettier-plugin-tailwindcss`
sorts classes). `npm run format` before opening a PR.

---

## 11. Deployment

- **Vercel** is the reference target; the App Router needs no special config.
- Set every variable from `.env.example` in the hosting environment. `SUPABASE_SECRET_KEY`
  and `SUPABASE_JWKS_URL` are server-only — don't expose them to preview environments
  you don't trust.
- Set `NEXT_PUBLIC_SITE_URL` to the production origin so metadata and redirect URLs are
  absolute and correct.
- Add the production `/auth/callback` URL to **Supabase → Authentication → URL
  Configuration → Redirect URLs**.
- The proxy runs on the Node.js runtime (always, in Next.js 16) with the matcher in
  `src/proxy.ts` excluding static assets, `api/*`, `auth/*` and the image optimizer.
- `supabase/migrations` are applied with `db:remote:push` (CI step) or manually via the SQL
  editor — never implicitly at request time.
