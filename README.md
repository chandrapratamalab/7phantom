# 7phantom

A **server-first, multilingual** Next.js foundation with Supabase, Tailwind CSS and
shadcn/ui — structured so you can drop a PRD on top and start shipping features.

- **Server-first by default.** React Server Components read data directly; Client
  Components exist only where they must.
- **Internationalized from the route up.** `/[lang]/…` routes, type-checked JSON
  dictionaries, an interactive language switcher and a dependency-free locale
  negotiator.
- **Secure by construction.** Public/private environment variables are separated at
  the module level, input is validated with Zod, and every mutation re-verifies the
  Supabase session. Row Level Security is the real access guard.
- **A real design system.** shadcn/ui with CSS-variable tokens, light/dark themes and
  a rebrand point that is one value wide.

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Quick start](#quick-start)
3. [Supabase setup](#supabase-setup)
4. [Troubleshooting](#troubleshooting)
5. [Environment variables](#environment-variables)
6. [Scripts](#scripts)
7. [Project structure](#project-structure)
8. [AI agent skills (recommended)](#ai-agent-skills-recommended)
9. [shadcn/ui & the Supabase registry](#shadcnui--the-supabase-registry)
10. [Core architecture rules](#core-architecture-rules)
11. [Where to go next](#where-to-go-next)

---

## Tech stack

| Area            | Choice                                 | Notes                                                                     |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Framework       | **Next.js 16** (App Router, Turbopack) | `proxy.ts` replaces `middleware.ts`; async `params`/`searchParams`        |
| Language        | **TypeScript 6** (strict)              | `verbatimModuleSyntax`, `@/*` path alias                                  |
| UI runtime      | **React 19**                           | RSC + Server Actions (`useActionState`)                                   |
| Styling         | **Tailwind CSS v4** (CSS-first)        | Design tokens in `src/app/globals.css`                                    |
| Components      | **shadcn/ui** (new-york, neutral)      | Radix primitives, `class-variance-authority`                              |
| Backend/Auth/DB | **Supabase** (`@supabase/ssr`)         | Cookies-based sessions, RLS, JWKS-verified JWTs                           |
| Validation      | **Zod 4**                              | Schemas as factories, translated messages                                 |
| Theming         | **Built-in provider**                  | Class-based light/dark/system; no-FOUC script via `useServerInsertedHTML` |
| Lint/format     | **ESLint 10** + **Prettier 3**         | `eslint-config-next`, Tailwind class sorting                              |

---

## Quick start

**Prerequisites**

- **Node.js ≥ 20.9** and **npm ≥ 10**
- A Supabase backend — pick **one**:
  - a **hosted** project (free tier is fine), or
  - the **local stack**, which requires **Docker Desktop** running.

```bash
# 1. Install dependencies
npm install

# 2. Create your env file, then fill it in (see Environment variables)
cp .env.example .env.local

# 3. Provision the database — pick ONE of the two options in Supabase setup:
#
#    a) Hosted project (cloud)
npm run supabase:login
npm run supabase:link -- --project-ref <your-project-ref>
npm run db:remote:push
#
#    b) Local stack (Docker running)
npm run supabase:start
npm run db:local:reset

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000> — the proxy negotiates a locale and redirects to
`/en` (or `/id`).

> **First account.** Visit `/en/login` to create it. With the default "Confirm
> email" setting you must confirm before signing in — on the **local stack** every
> email is captured by the mail catcher at <http://127.0.0.1:54324> instead of being
> sent. To skip confirmation while developing, turn off
> **Authentication → Sign In / Providers → Email → Confirm email**.
>
> **Local demo account.** `npm run db:local:reset` seeds one already-confirmed user
> you can sign in with immediately (see [`supabase/seed.sql`](#scripts)):
>
> | Email              | Password      |
> | ------------------ | ------------- |
> | `demo@example.com` | `password123` |
>
> It also creates two example notes. Local only — the seed never runs against a
> hosted project.

---

## Supabase setup

You can run Supabase **hosted** (cloud) or **local** (Docker). Pick one — the
environment values differ (see [Environment variables](#environment-variables)).

|           | Hosted project                                        | Local stack                         |
| --------- | ----------------------------------------------------- | ----------------------------------- |
| Best for  | Sharing, deploying, real data                         | Offline dev, instant resets         |
| Needs     | a supabase.com project                                | Docker Desktop                      |
| API URL   | `https://<ref>.supabase.co`                           | `http://127.0.0.1:54321`            |
| Provision | `supabase:login` → `supabase:link` → `db:remote:push` | `supabase:start` → `db:local:reset` |

The initial migration, `supabase/migrations/20260101000000_init.sql`, creates the
`profiles` and `notes` tables, enables RLS and installs the `handle_new_user`
trigger.

### Option A — Hosted project (cloud)

**1. Create the project** at <https://supabase.com/dashboard> (the free tier is fine).

**2. Log in and link the CLI.** `supabase login` is required once per machine — without
it, `supabase link` fails with **"not logged in"**.

```bash
npm run supabase:login                                   # browser or access token
npm run supabase:link -- --project-ref <your-project-ref>
```

`<your-project-ref>` is the ID in your project URL:
`https://<your-project-ref>.supabase.co`.

**3. Copy the API keys** from **Project Settings → API Keys** into `.env.local`:

| Dashboard value                      | Environment variable                   |
| ------------------------------------ | -------------------------------------- |
| Project URL                          | `NEXT_PUBLIC_SUPABASE_URL`             |
| Publishable key (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key (`sb_secret_…`)           | `SUPABASE_SECRET_KEY` _(server only)_  |

Then build the JWKS URL from the project URL:
`https://<your-project-ref>.supabase.co/auth/v1/.well-known/jwks.json` →
`SUPABASE_JWKS_URL`.

> The publishable/secret key pair replaces the legacy `anon` / `service_role` keys.
> Older projects still show those names; they map 1:1 (`anon` → publishable,
> `service_role` → secret).

**4. Apply the schema and regenerate types.**

```bash
npm run db:remote:push     # applies supabase/migrations/* to the linked project
npm run db:remote:types    # regenerate src/utils/supabase/types.ts (--linked)
```

<details>
<summary>No CLI? Paste the SQL instead</summary>

Open `supabase/migrations/20260101000000_init.sql`, copy its contents into the
dashboard **SQL Editor** and run it.
</details>

**5. Configure redirect URLs.** In **Authentication → URL Configuration → Redirect
URLs**, add:

```
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

This is required for email confirmation, magic links and OAuth. Set the **Site URL**
to your canonical origin.

### Option B — Local stack (Docker)

Everything runs on your machine — nothing is shared or deployed. **Docker Desktop
must be running** for every command below.

**1. Ensure `supabase/config.toml` exists.** This starter already ships one
(`project_id = "7phantom"`). If you started from scratch, create it — you can also
set ports here:

```bash
npm run supabase:init      # creates supabase/config.toml
```

**2. Check the ports.** `npm run supabase:start` binds these. If any is already taken, change
it in `supabase/config.toml` before starting:

| Service                 | Port  | URL                    |
| ----------------------- | ----- | ---------------------- |
| API (Kong)              | 54321 | http://127.0.0.1:54321 |
| Postgres                | 54325 | —                      |
| Studio                  | 54323 | http://127.0.0.1:54323 |
| Mail catcher (Inbucket) | 54324 | http://127.0.0.1:54324 |
| Analytics               | 54327 | —                      |

**3. Start, migrate and regenerate types.**

```bash
npm run supabase:start     # first run pulls Docker images (a few minutes)
npm run db:local:reset     # applies migrations + supabase/seed.sql
npm run db:local:types     # regenerate src/utils/supabase/types.ts (--local)
```

**4. Copy the local keys.** `supabase:start` (and `npm run supabase:status`) print the local
**API URL**, **anon/publishable key** and **service_role/secret key** — put them in
`.env.local` (see the next section).

Stop the stack with `npm run supabase:stop`.

### Applying migrations locally

First-time setup runs `db:local:reset` once (fresh database + `supabase/seed.sql`).
After that **you rarely need to reset** — apply new migrations without losing local data:

| Situation                                                                               | Command                  | Local data |
| --------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| You added a **new** migration file                                                      | `npm run db:local:push`  | **kept**   |
| You edited/renamed an **already-applied** migration, or want `seed.sql` / a clean slate | `npm run db:local:reset` | **wiped**  |

- `db:local:push` runs only the **pending** migrations (`supabase migration up`) and never
  seeds. Fast and non-destructive.
- `db:local:reset` recreates Postgres from scratch and re-runs **every** migration plus
  `supabase/seed.sql`.
- Applied migrations are tracked in `supabase_migrations.schema_migrations`, so an
  already-applied file is **skipped**. Rule of thumb: **add** migrations (never rewrite
  them) → `push`; you rewrote history → `reset`.

---

## Troubleshooting

| Symptom                                                | Fix                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase link` → **"not logged in"**                  | Run `npm run supabase:login` first (once per machine).                                                                                                                          |
| `npm run db:local:reset` → **cannot connect / Docker** | `db:local:reset` targets the **local** stack only. Start Docker Desktop, then `npm run supabase:start` before it. To update a **hosted** project, use `npm run db:remote:push`. |
| **Port already allocated** (`54321`, `54323`, …)       | Change the port under the matching section in `supabase/config.toml`, then `npm run supabase:stop` and `npm run supabase:start`.                                                |
| `npm run db:local:types` fails                         | It reads the **local** DB (`--local`). Start the stack (`npm run supabase:start`), or use `npm run db:remote:types` for a hosted project.                                       |
| **Confirm email** blocks sign-in                       | Local: open the mail catcher at <http://127.0.0.1:54324>. Hosted: click the emailed link, or turn off _Confirm email_ in Authentication settings.                               |
| **Demo user gets "Invalid email or password"**         | Re-run `npm run db:local:reset`. A hand-edited `auth.users` row with a `NULL` `confirmation_token` makes GoTrue return 500, which sign-in reports as invalid credentials.       |
| **No redirect** from `/` to `/en`                      | The proxy reads `Accept-Language`; visit `/en` or `/id` directly to confirm routing works.                                                                                      |
| **`NEXT_PUBLIC_*` is `undefined`** in the browser      | Restart `npm run dev` after editing `.env.local` — env is read at module load.                                                                                                  |
| **Schema changes not reflected**                       | Add a new migration, then `npm run db:local:push` (local, keeps data) or `npm run db:remote:push` (hosted), then regenerate types.                                              |
| **Don't want to lose local data on every change**      | Use `npm run db:local:push` (pending migrations only). Reserve `db:local:reset` for a clean slate or after rewriting migration history.                                         |
| **Edited an already-applied migration**                | Migrations are append-only, so the edit is ignored. Add a new migration, or `npm run db:local:reset` to rebuild from scratch.                                                   |

---

## Environment variables

Copy `.env.example` to `.env.local`. **`.env*.local` is gitignored — never commit keys.**

| Variable                               | Scope       | Purpose                                                       |
| -------------------------------------- | ----------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | public      | Supabase project URL.                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public      | Browser-safe key. RLS enforces access, not secrecy.           |
| `NEXT_PUBLIC_SITE_URL`                 | public      | Canonical origin for absolute redirect URLs and metadata.     |
| `SUPABASE_SECRET_KEY`                  | **private** | Bypasses RLS. Only `src/utils/supabase/admin.ts` may read it. |
| `SUPABASE_JWKS_URL`                    | **private** | Local JWT verification for bearer-token route handlers.       |
| `SUPABASE_DB_URL`                      | **private** | Optional direct Postgres URL (migrations / raw SQL).          |

**Typical `.env.local`**

Hosted project:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=sb_secret_…
SUPABASE_JWKS_URL=https://<your-project-ref>.supabase.co/auth/v1/.well-known/jwks.json
# SUPABASE_DB_URL=postgresql://postgres:<password>@db.<your-project-ref>.supabase.co:5432/postgres
```

Local stack (values from `npm run supabase:status`; note the Postgres port is `54325`):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key printed by `npm run supabase:status`>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=<service_role key printed by `npm run supabase:status`>
SUPABASE_JWKS_URL=http://127.0.0.1:54321/auth/v1/.well-known/jwks.json
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54325/postgres
```

**Rules**

1. `NEXT_PUBLIC_*` is inlined into the browser bundle. Never put a secret there.
2. Private values are read through `src/lib/env/server.ts`, which imports
   `server-only` — the build fails if a Client Component reaches it.
3. Public values are read through `src/lib/env/client.ts`.

---

## Scripts

| Script                    | Target    | What it does                                                  |
| ------------------------- | --------- | ------------------------------------------------------------- |
| `npm run dev`             | —         | Start the dev server (Turbopack).                             |
| `npm run build`           | —         | Production build.                                             |
| `npm run start`           | —         | Serve the production build.                                   |
| `npm run lint`            | —         | ESLint over the repo.                                         |
| `npm run typecheck`       | —         | `tsc --noEmit`. Run `npx next typegen` first for route types. |
| `npm run format`          | —         | Prettier write.                                               |
| `npm run supabase:init`   | —         | Create `supabase/config.toml` (already shipped here).         |
| `npm run supabase:login`  | **cloud** | Log the CLI into Supabase (once per machine).                 |
| `npm run supabase:link`   | **cloud** | Link to a hosted project: `-- --project-ref <ref>`.           |
| `npm run supabase:start`  | **local** | Start the local stack (Docker). Prints the local URL + keys.  |
| `npm run supabase:stop`   | **local** | Stop the local stack.                                         |
| `npm run supabase:status` | **local** | Show the local URLs and keys.                                 |
| `npm run db:local:push`   | **local** | Apply pending migrations, keep data (`migration up`).         |
| `npm run db:local:reset`  | **local** | Clean slate: recreate DB, re-run migrations + `seed.sql`.     |
| `npm run db:local:types`  | **local** | Regenerate types from the local DB (`--local`).               |
| `npm run db:remote:push`  | **cloud** | Push `supabase/migrations/*` to the linked project.           |
| `npm run db:remote:types` | **cloud** | Regenerate types from the linked project (`--linked`).        |

> **Local vs cloud at a glance:** `supabase:*` manages the stack/account; `db:local:*`
> only ever touches your machine; `db:remote:*` only ever touches the hosted project.

---

## Project structure

```
.
├─ src/
│  ├─ actions/                    # Server Actions ("use server")
│  │  └─ auth.ts                  #   signIn / signUp / signOut
│  ├─ app/
│  │  ├─ [lang]/                  # Locale-scoped route tree
│  │  │  ├─ layout.tsx            #   <html lang dir>, fonts, header, toaster
│  │  │  ├─ page.tsx              #   landing page (SSG)
│  │  │  ├─ not-found.tsx         #   locale-aware 404
│  │  │  ├─ login/page.tsx        #   auth shell (dynamic)
│  │  │  └─ dashboard/page.tsx    #   protected page (dynamic)
│  │  ├─ api/me/route.ts          # Bearer-token endpoint (JWKS-verified)
│  │  ├─ auth/callback/route.ts   # PKCE exchange (email / OAuth)
│  │  └─ globals.css              # Design system: tokens, dark mode, theme bridge
│  ├─ components/
│  │  ├─ ui/                      # shadcn/ui primitives
│  │  ├─ features/                # App-specific components (header, forms, switches)
│  │  └─ theme-provider.tsx       # theme provider (context + no-FOUC script)
│  ├─ dictionaries/               # en.json, id.json + typed lazy loader
│  ├─ i18n/                       # locales, negotiation, path helpers, formatting
│  ├─ lib/
│  │  ├─ auth/                    # Dal (getCurrentUser/requireUser), JWT verify, state
│  │  ├─ env/                     # client.ts (public) / server.ts (private)
│  │  ├─ validations/             # Zod schemas
│  │  ├─ routes.ts                # Central route map + protection + safe redirects
│  │  └─ utils.ts                 # cn()
│  ├─ utils/supabase/             # client / server / admin / middleware / types
│  └─ proxy.ts                    # i18n + session refresh + route protection
├─ supabase/
│  ├─ config.toml                 # Local stack config (ports, project_id)
│  ├─ seed.sql                    # Local-only seed data (db:local:reset)
│  └─ migrations/                 # SQL migrations (RLS, triggers)
├─ docs/
│  ├─ ARCHITECTURE.md             # Deep dive + conventions
│  └─ PRD-FOUNDATION.md           # What this foundation delivers
├─ .env.example                   # Documented env template
├─ components.json                # shadcn/ui config (+ @supabase registry)
├─ next.config.ts                 # Images, security headers
├─ tailwind.config.ts             # Legacy shim (fonts/radii/container only)
└─ tsconfig.json                  # Strict TS, @/* alias
```

---

## AI agent skills (recommended)

This project is meant to be extended by AI coding agents. Install the official
Supabase skills so the agent follows current Supabase conventions instead of
guessing. Run these from the repository root:

```bash
# Supabase agent skills (schema, RLS, auth, edge functions, migrations)
npx skills add supabase/agent-skills

# The @supabase/server package skill (server clients, auth modes, Edge Functions)
npx skills add supabase/server
```

Optional — install just the Postgres best-practices skill:

```bash
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices
```

Check what is available before installing, and inspect what is already present:

```bash
npx skills add supabase/agent-skills --list
npx skills list
```

Skills are installed at **project scope** by default (shared with your team through
git). Add `--global` to install across all your projects, or `--agent <name>` to
target a specific agent.

---

## shadcn/ui & the Supabase registry

Components are added with the shadcn CLI. The Supabase component registry is already
mapped in `components.json` as `@supabase`:

```bash
# Add any standard shadcn/ui primitive
npx shadcn@latest add dialog sheet table tabs

# Add Supabase-provided blocks (drop-in, already wired to @supabase/ssr)
npx shadcn@latest add @supabase/supabase-client-nextjs
npx shadcn@latest add @supabase/password-based-auth-nextjs
npx shadcn@latest add @supabase/social-auth-nextjs
npx shadcn@latest add @supabase/current-user-avatar-nextjs
```

> The blocks above are illustrative starting points. This repo already ships its own
> thin Supabase utilities in `src/utils/supabase/`, so treat registry blocks as
> reference implementations and reconcile them with the existing files.

---

## Core architecture rules

A short version of `docs/ARCHITECTURE.md` — read that file before building features.

1. **Default to Server Components.** Add `"use client"` only for state, effects,
   browser APIs or event handlers, and keep it at the leaves.
2. **Never trust input.** Every Server Action validates with Zod and re-checks the
   session via `requireUser()` / `getCurrentUser()`. Actions are public endpoints.
3. **Never leak secrets.** Private env is `server-only`. The admin client is
   `server-only` and stateless. RLS protects data even if the publishable key leaks.
4. **Mutations go through the DAL or Server Actions**, not directly from Client
   Components with the browser client — except for realtime/subscriptions.
5. **All user-facing strings live in dictionaries**, keyed under a feature namespace.
6. **One route map.** Build hrefs with `localizedPath(lang, routes.x)`, never by
   string concatenation.

---

## Where to go next

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — RSC vs Client rules, secret-leak
  prevention, Server Action security, i18n extension, DB/RLS conventions, feature
  recipes.
- **[docs/PRD-FOUNDATION.md](docs/PRD-FOUNDATION.md)** — the scope this foundation
  fulfils and the checklist for building features on top of it.

Then: fork the patterns in `src/app/[lang]/dashboard/page.tsx` (protected read) and
`src/actions/auth.ts` (validated mutation) to implement your PRD.
