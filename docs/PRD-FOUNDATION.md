# PRD — Foundation

Status: **Delivered (draft)** · Audience: the person (or agent) about to build a
product on top of this repository.

This document defines what the foundation is, what it deliberately is **not**, and
the acceptance criteria it was built and verified against. It is the contract between
"the base is done" and "start implementing the product PRD."

---

## 1. Purpose

Give a product team a **clean, secure, multilingual, server-first starting point** so
that the first week of a new project is spent on the product, not on wiring auth,
i18n, theming, database conventions and guardrails. The foundation should be small
enough to understand in an afternoon and opinionated enough that adding a feature
follows one obvious path.

## 2. Goals

| #   | Goal                                                                                        |
| --- | ------------------------------------------------------------------------------------------- |
| G1  | Server-first Next.js App Router base using RSC and Server Actions.                          |
| G2  | Full internationalization: locale-prefixed routes, type-checked dictionaries, switcher.     |
| G3  | Supabase integrated natively (`@supabase/ssr`), with correct cookie-based session handling. |
| G4  | A design system (Tailwind v4 + shadcn/ui) with light/dark themes and CSS-variable rebrand.  |
| G5  | Security guardrails that make secret leakage and unvalidated mutations structurally hard.   |
| G6  | Conventions (folders, RLS, migrations, env, routes) that scale without rewrites.            |
| G7  | Documentation that lets a new contributor or AI agent extend it without archaeology.        |

## 3. Non-goals

Explicitly **out of scope** for the foundation:

- Product/domain features (the schema ships one illustrative `notes` table only).
- A marketing site, pricing, or CMS.
- Billing, teams/organizations, RBAC beyond "owner of own rows".
- Email templates beyond Supabase defaults; transactional email providers.
- Full observability (analytics, tracing, error tracker) — hooks are noted, not wired.
- A test suite (see [§7](#7-out-of-scope--recommended-next-increments)).
- A finalized CSP (depends on the product's third parties; baseline headers only).

## 4. Primary use case

A small team starts a new product that must ship in **English and Indonesian**,
authenticate users with **email + password**, store **per-user data** in Postgres, and
be safe to hand to AI coding agents for feature work.

## 5. Scope delivered

### 5.1 Project & tooling

- Next.js **16.4** (App Router, Turbopack), React **19.3**, TypeScript **6** strict.
- ESLint 10 (`eslint-config-next`), Prettier 3 + Tailwind class sorting.
- `@/*` path alias; `type: "module"`; engines `node >= 20.9`.

### 5.2 Internationalization (G2)

- `src/i18n/config.ts` — `locales`, `defaultLocale`, `localeMeta`, `isLocale`.
- `src/i18n/locale.ts` — `localizedPath`, `stripLocale`, `swapLocale`,
  `negotiateLocale` (dependency-free RFC 9110), `localeAlternates`.
- `src/i18n/format.ts` — `interpolate`.
- `src/dictionaries/{en,id}.json` + `index.ts` — lazy, typed (`Dictionary = typeof en`),
  `server-only`, one loader per locale enforced at compile time.
- `src/app/[lang]/` route tree with `<html lang dir>`, `generateStaticParams`, hreflang
  alternates, and a locale-aware 404.
- `LanguageSwitcher` — swaps only the locale segment, preserves path + query, remembers
  the choice in a cookie.

### 5.3 Supabase (G3)

- `@supabase/ssr` clients: `client.ts` (browser), `server.ts` (per-request),
  `admin.ts` (service role, `server-only`), `middleware.ts` (session refresh).
- `src/proxy.ts` — session refresh → locale prefix → protected-route gate → locale
  cookie, with auth cookies inherited by every redirect.
- Auth: `signInAction`, `signUpAction`, `signOutAction` (validated, session-aware).
- PKCE callback at `/auth/callback` for email confirmation, magic links, OAuth.
- Bearer-token verification (`verifySupabaseJwt` via JWKS) with an example at `/api/me`.
- Typed client placeholder (`types.ts`) regenerable with `npm run db:local:types`
  (local) or `npm run db:remote:types` (hosted).

### 5.4 Design system (G4)

- `src/app/globals.css` — Tailwind v4 import, `@config` shim, `@custom-variant dark`,
  `@theme inline` token bridge, `:root`/`.dark` OKLCH tokens, base layer, `@utility`.
- `tailwind.config.ts` — legacy shim (fonts/radii/container) only; no colors.
- shadcn/ui primitives in `src/components/ui/` (`button`, `card`, `input`, `label`,
  `dropdown-menu`, `sonner`), `cn()` helper, and a built-in theme provider + toggle.
- `components.json` with the `@supabase` registry mapped.

### 5.5 Security (G5)

- Public/private env split (`src/lib/env/client.ts` vs `server.ts`), lazy validation.
- `server-only` on private env, admin client, DAL and dictionaries.
- Zod-validated Server Actions that re-verify the session; generic auth errors.
- `safeRedirectPath` open-redirect guard applied to `?next=`.
- DAL with `getClaims` (UI) vs `getCurrentUser`/`requireUser` (authorization).
- RLS on every table; admin client's blast radius documented and contained.
- Baseline security headers in `next.config.ts`.

### 5.6 Conventions (G6)

- Documented directory responsibilities; `"use server"` export-rule split.
- Route map + `protectedRoutePrefixes` + safe-redirect helper in `src/lib/routes.ts`.
- RLS/migration conventions (FK + index, named policies, `(select auth.uid())`,
  `security definer` with empty `search_path`, `updated_at` trigger).
- npm scripts for dev/build/lint/typecheck/format/db.

### 5.7 Documentation (G7)

- `README.md` — quick start, env, Supabase setup, skills, registry, structure.
- `docs/ARCHITECTURE.md` — the rules, with rationale and recipes.
- This document.
- AI agent skill instructions: `npx skills add supabase/agent-skills` and
  `npx skills add supabase/server`.

## 6. Acceptance criteria

Each item is verifiable; the verification method is in brackets.

### Functional

- [x] `/` redirects to a negotiated locale (`/en` or `/id`). _[proxy behaviour]_
- [x] `/en`, `/id` render and are prerendered at build time. _[build output: SSG]_
- [x] `hreflang` alternates are emitted per page. _[`localeAlternates` in metadata]_
- [x] The language switcher preserves the current page and query string.
- [x] A 404 renders the message in every supported language. _[`not-found.tsx`]_
- [x] Adding a locale requires exactly three edits (config, dictionary, loader).
- [x] Missing/mismatched dictionary keys fail `tsc`. _[`Dictionary = typeof en`]_
- [x] Sign-up, sign-in and sign-out work via Server Actions. _[`src/actions/auth.ts`]_
- [x] Unauthenticated access to `/dashboard` redirects to a localized login with `?next=`.
- [x] The authenticated dashboard reads RLS-scoped rows with no `where user_id`.
- [x] `/api/me` returns claims for a valid bearer token and 401 otherwise. _[JWKS verify]_
- [x] Light/dark/system theming works and persists. _[theme provider + `.dark`]_
- [x] Error states are announced to assistive tech (`role="alert"`, `aria-live`).

### Security

- [x] A Client Component importing private env / admin / DAL fails the build.
      _[`server-only`]_
- [x] `SUPABASE_SECRET_KEY` is read only through `getServerEnv()`.
- [x] Every migration enables RLS with explicit per-operation policies.
- [x] Server Actions validate DTOs with Zod and re-check the session.
- [x] `?next=` cannot redirect off-origin.
- [x] Sign-in errors don't disclose whether an account exists.

### Quality

- [x] `npx next typegen` succeeds.
- [x] `npx tsc --noEmit` reports **0 errors**.
- [x] `npx eslint .` reports **0 errors, 0 warnings**.
- [x] `npx next build` succeeds with no `.env.local` present.
- [x] Built CSS contains a `:root` token block, a `.dark{…}` override block and the
      font variables. _[verified in `.next/static/chunks/*.css`]_

## 7. Out of scope / recommended next increments

Suggested order for building on the foundation:

1. **Test harness.** Add Vitest + React Testing Library and Playwright; test the
   locale helpers and one Server Action first. (No tests ship in the foundation.)
2. **CSP.** Define a `Content-Security-Policy` once third parties are known, via
   `next.config.ts` headers or the proxy.
3. **Profile UI.** Use `profiles` (already migrated) to edit name/avatar/locale;
   add a storage bucket with its own RLS policies.
4. **OAuth providers.** Wire `social-auth-nextjs` (or the Supabase docs) and extend
   `/auth/callback`.
5. **Realtime / subscriptions.** Use the browser client for realtime channels only.
6. **Organizations / roles.** Add a membership table + policies; keep authorization in
   the DAL and enforce in RLS.
7. **Observability.** Error tracking + analytics + tracing, with a durable audit of
   privileged (admin-client) calls.
8. **Rate limiting.** Edge/KV-based protection on auth and mutation endpoints.
9. **`typedRoutes`.** Turn it on and thread `Route` types through `localizedPath` once
   routes are stable.
10. **ICU messages.** Swap `interpolate` for `intl-messageformat` when the product needs
    plurals/gender.

## 8. Definition of done

The foundation is done when a new contributor can, without prior context:

1. Follow the README to get the app running with their own Supabase project.
2. Read `docs/ARCHITECTURE.md` and add a page, a validated Server Action, and a
   protected table **without inventing new patterns**.
3. Trust that secrets stay server-side and that data access is enforced in Postgres.

All acceptance criteria in [§6](#6-acceptance-criteria) pass.

## 9. Verification log

Run on Node 24 / npm 11 with the pinned dependency tree:

| Check                 | Command                        | Result                              |
| --------------------- | ------------------------------ | ----------------------------------- |
| Route types           | `npx next typegen`             | ✅ generated                        |
| Types                 | `npx tsc --noEmit`             | ✅ 0 errors                         |
| Lint                  | `npx eslint .`                 | ✅ clean                            |
| Production build      | `npx next build`               | ✅ 0 errors                         |
| Prerender             | build output                   | `/en`, `/id` SSG                    |
| Design tokens in CSS  | inspect `.next/**/*.css`       | ✅ `:root` + `.dark` + fonts        |
| Theme no-flash script | `/en.html` vs `RSC: 1` request | ✅ in HTML, absent from RSC payload |
| Local DB + seed       | `npm run db:local:reset`       | ✅ migrations + `seed.sql` applied  |
| Seeded demo login     | `POST /auth/v1/token` (local)  | ✅ 200, token issued                |

Not yet committed — the working tree holds the full foundation as new, uncommitted
files.
