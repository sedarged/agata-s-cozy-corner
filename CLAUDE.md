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

- **Lovable fully ejected** — `vite.config.ts` now uses native `tanstackStart()` + `nitro()` +
  `viteReact()` + `tailwindcss()` + `tsConfigPaths()` with `node-server` preset. The
  `@lovable.dev/vite-tanstack-config` devDep is removed.
- **Supabase removed** — all `src/integrations/supabase/*`, `supabase-safe.ts`, `cloud-sync.ts`,
  `supabase-mappers.ts`, `queries.ts`, `use-auth.ts` deleted. `auth-context.tsx` is now a no-op
  shell (private app — auth at the network level via Caddy/Tailscale on VPS). No Supabase deps in
  `package.json`.
- **Gigi works without auth** — `gigi.tsx` passes localStorage context (books/notes) in the POST
  body. `/api/chat` supports `OPENAI_API_KEY` (primary) or `LOVABLE_API_KEY` (fallback); optional
  `GIGI_SECRET` env var for network-level protection.
- **Real data only** — demo/seed arrays in `src/lib/mock-data.ts` are emptied; the app shows just
  the user's own data.
- **Book search is real and server-side** — `/api/book-search`: Google Books + Open Library +
  Biblioteka Narodowa, merged/deduped, Polish ranked first. ⚠️ BN field mapping not yet verified
  against the live API.
- **Settings** — all sections implemented: default book status, default note style, tag manager,
  Gigi privacy (localStorage), backup, storage/server health, themes, goals, about.

Work is on branch **`claude/page-completion-production-6qs78b`**.

## Active roadmap — self-host on the VPS

Phases 1 (Vite eject) and partial Phase 3 (Supabase removal) are **done**. Remaining:

1. ~~Eject the Vite config~~ ✅ **DONE**
2. **SQLite foundation** — Drizzle + better-sqlite3, schema/migrations, `DATA_DIR`, `/api/db-health`.
3. ~~Remove Supabase~~ ✅ **DONE**
4. **Gigi → Sign in with ChatGPT** (optional) — OAuth 2.0 PKCE; or just set `OPENAI_API_KEY`.
5. **Server CRUD API** (P1) and **client React-Query cutover** (P3) — move off `localStorage`.
6. **Assets pipeline** (P2), **migration importer** (P4), **deploy/ops** (P5).

Full detail: [`docs/exit-lovable-plan.md`](./docs/exit-lovable-plan.md) and
[`docs/local-database-plan.md`](./docs/local-database-plan.md).

## Build / run / verify

```bash
npm install            # required on VPS; this sandbox can't (registry 403)
npm run dev            # vite dev
npm run build          # vite build → .output/server/index.mjs (node-server)
npm run lint           # eslint
```

No `tsc` script — run `npx tsc --noEmit` manually. The router plugin regenerates
`src/routeTree.gen.ts` on dev/build.

### Environment variables (VPS)

```
OPENAI_API_KEY=...          # Gigi primary AI provider (gpt-4o-mini)
LOVABLE_API_KEY=...         # Gigi fallback (Lovable gateway, Gemini) — optional
GIGI_SECRET=...             # Optional — require X-Gigi-Key header for /api/chat
DATA_DIR=/var/lib/agata     # Future: SQLite database location
```

## Conventions

- **Server-only modules** use the `*.server.ts` suffix; never import from client code.
- API routes: `createFileRoute("/api/…").server.handlers`.
- Stores expose a stable interface (`getAllBooks`, `createBook`, `useBooksVersion`, …).
- Polish UI strings; English code. Match existing file style; new files must be lint/prettier-clean.

## Sandbox constraint note

Changes authored without `npm install` (registry 403 in sandbox). **Verify on the VPS:**
```bash
npm install && npm run build
```
Expected: `.output/server/index.mjs` produced, no Lovable/Supabase errors in output.
