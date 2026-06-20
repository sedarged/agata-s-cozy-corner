# CLAUDE.md — working state & handoff for Claude Code

This is the entry point for any Claude/Codex/agent session on this repo (e.g. Claude CLI on the
VPS after a fresh clone). It captures **current state, what changed recently, the active roadmap,
and how to build/verify**. Detailed docs live in [`docs/`](./docs/README.md).

## What this is

**Agata** — a private, personal reading / library / notes / quotes / reading-session app
(Polish UI). It is for a single user, hosted long-term on the owner's **VPS**. No multi-tenant,
no public sign-up. UI text is Polish; code/comments are English.

## Stack

- **TanStack Start** (`@tanstack/react-start`, Nitro server) + **React 19** + **Vite** + **TanStack Router/Query**.
- **Tailwind v4**, Radix UI, lucide-react.
- Data today: **browser `localStorage`** via store modules. Server API routes for chat + book search.
- Target architecture: **server-authoritative SQLite on the VPS** (see roadmap).

## Current state (2026-06-20)

- **Real data only** — demo/seed arrays in `src/lib/mock-data.ts` are emptied; the app shows just
  the user's own data. `mock-data.ts` now provides **types + helpers only**.
- **Book search is real and server-side** — `/api/book-search` (`src/routes/api/book-search.ts`)
  calls `src/lib/book-search.server.ts`: **Google Books + Open Library + Biblioteka Narodowa
  (data.bn.org.pl)**, merged/deduped, Polish ranked first, covers via `?default=false` + ISBN
  backfill. Client wrapper `src/lib/book-search.ts` just calls the endpoint. ⚠️ The BN field
  mapping was written from docs and **not yet verified against the live API** (see issues).
- **Gigi** (`src/routes/gigi.tsx`) calls the real `/api/chat` with streaming + graceful
  loading/error states. It is **gated on auth, which is intentionally hidden** (`SHOW_AUTH_UI = false`
  in `src/lib/feature-flags.ts`, private app), so Gigi shows a "connect/sign-in" state and does not
  chat yet. The backend currently routes through the **Lovable AI gateway** — being replaced (roadmap).
- **Settings** — the four previously-stubbed sections are implemented (default book status, default
  note style, tag manager, About) via `src/lib/preferences.ts`.
- **Bug fixes landed** — book-route error screen (no raw `error.message`), dark-mode theme flicker,
  notifications bell popover.
- **Lovable exit started** — dead Lovable modules removed (`src/integrations/lovable/`,
  `src/lib/lovable-error-reporting.ts`, dep `@lovable.dev/cloud-auth-js`). Remaining coupling:
  the Vite wrapper, the AI gateway, and Supabase (all on the roadmap).

Work is on branch **`claude/todo-implementation-p07a5z`** (draft PR **#2**).

## Active roadmap — Exit Lovable & self-host on the VPS

Full detail + the "Sign in with ChatGPT" research: [`docs/exit-lovable-plan.md`](./docs/exit-lovable-plan.md).
Datastore detail: [`docs/local-database-plan.md`](./docs/local-database-plan.md). Tracked as GitHub
issues (see the **"Exit Lovable & self-host"** epic). Recommended order:

1. **Eject the Vite config** off `@lovable.dev/vite-tanstack-config` → plain `tanstackStart()` +
   `viteReact()` + `tailwindcss()` + `tsConfigPaths()`, **node-server** Nitro target.
2. **SQLite foundation** — Drizzle + better-sqlite3, schema/migrations, `DATA_DIR`, `/api/db-health`.
3. **Gigi → Sign in with ChatGPT** — OAuth 2.0 PKCE (personal subscription), replace the Lovable gateway.
4. **Server CRUD API** (P1) and **client React-Query cutover** (P3) — move off `localStorage`/Supabase.
5. **Assets pipeline** (P2), **migration importer** (P4), **deploy/ops** (P5).

## Build / run / verify

```bash
npm install            # this sandbox can't (registry 403); the VPS can
npm run dev            # vite dev
npm run build          # vite build (regenerates src/routeTree.gen.ts)
npm run lint           # eslint (repo has pre-existing prettier-only warnings; keep NEW files clean)
```
There is **no `tsc` script**; `npx tsc --noEmit` works once deps are installed. The router plugin
regenerates `src/routeTree.gen.ts` on dev/build — when you add an `/api/*` route, also register it
there (mirror how `/api/book-search` and `/api/chat` are wired) or just run a build.

## Conventions

- **Server-only modules** use the `*.server.ts` suffix (e.g. `book-search.server.ts`,
  `ai-gateway.server.ts`) and must never be imported by client code.
- API routes: `createFileRoute("/api/…").server.handlers` (see `src/routes/api/chat.ts`).
- Stores expose a stable interface (`getAllBooks`, `createBook`, `useBooksVersion`, …); when the
  SQLite cutover happens, keep that seam where practical.
- Polish UI strings; English code. Match existing file style; new files must be lint/prettier-clean.
- Commit on the working branch; **do not force-push** (history syncs externally until the Vite
  eject lands).

## Environment

See [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md). Notably `LOVABLE_API_KEY` (current Gigi gateway)
is being retired; Supabase vars are being removed in favour of SQLite + a `DATA_DIR`.

## Sandbox constraint note

These changes were authored in a cloud sandbox **without** package install / build (npm registry
returns 403). Anything build-level (Vite eject, native SQLite, ChatGPT backend) must be **verified
on the VPS** with a real `npm install && npm run build`.
