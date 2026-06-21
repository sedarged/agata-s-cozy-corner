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

## Current state (2026-06-21)

- **Lovable fully ejected** — `vite.config.ts` uses native `tanstackStart()` + `nitro()` +
  `viteReact()` + `tailwindcss()` + `tsConfigPaths()` with `node-server` preset.
- **Supabase removed** — no cloud deps; auth at the network level via Caddy/Tailscale on VPS.
- **Gigi works without auth** — `gigi.tsx` passes localStorage context. `/api/chat` supports
  `OPENAI_API_KEY` (primary) or `LOVABLE_API_KEY` (fallback); optional `GIGI_SECRET`.
- **Phase 1 backend done (commit 1796df1)** — Drizzle + better-sqlite3 + server CRUD + React Query:
  - `src/lib/db/schema.ts` (TEXT ids, JSON tags, no user_id), 5 repos with integration tests (20/20)
  - `src/lib/api/*.functions.ts` — server functions, Zod-validated (23 schema tests)
  - `src/lib/api/client.ts` — React Query hooks (queries + mutations + query keys) with smoke tests
  - `src/lib/api/db-health.functions.ts` — `useDbHealthQuery` feeds `DatabaseStatus` (real DB counts)
  - `drizzle/0000_init.sql` migration; `drizzle.config.ts`; `npm run db:generate` / `db:migrate`
  - `dataDir()` from `process.env.DATA_DIR || .agata-data` (server-side only; native better-sqlite3)
- **Phase 1.5 remaining** — route consumers (28+ files) still use `*-store.ts` (localStorage).
  The store modules are intentionally kept as a backwards-compat shim; migrate incrementally.
  Also: `/api/assets/[id]` route for serving asset files; `/api/import` for backup JSON.

Work is on branch **`claude/agata-reading-app-oe9u3u`**.

## Active roadmap — self-host on the VPS

1. ~~Eject the Vite config~~ ✅ **DONE**
2. ~~SQLite foundation~~ ✅ **DONE** (Phase 1 backend; consumer migration in 1.5)
3. ~~Remove Supabase~~ ✅ **DONE**
4. **Krok 0 — VPS deploy** — systemd + Caddy + Tailscale cert. _Blocked on sudo cache._
5. **Phase 1.5 — React Query cutover** — migrate 28+ route consumers + `/api/assets/[id]` + importer.
6. **Faza 2 — Gigi via OAuth ChatGPT** — PKCE, encrypted token, Settings UI "Połącz ChatGPT".
7. Deploy, verify, monitor, ops.

Full detail: [`docs/exit-lovable-plan.md`](./docs/exit-lovable-plan.md) and
[`docs/local-database-plan.md`](./docs/local-database-plan.md).

## Build / run / verify

```bash
npm install            # required on VPS; this sandbox can't (registry 403)
npm run dev            # vite dev
npm run build          # vite build → .output/server/index.mjs (node-server)
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # node:test via tsx (49 tests: db repos + zod schemas + client surface)
npm run db:generate    # drizzle-kit generate (after schema change)
npm run db:migrate     # drizzle-kit migrate
```

The router plugin regenerates `src/routeTree.gen.ts` on dev/build.

### Environment variables (VPS)

```
OPENAI_API_KEY=...          # Gigi primary AI provider (gpt-4o-mini)
LOVABLE_API_KEY=...         # Gigi fallback (Lovable gateway, Gemini) — optional
GIGI_SECRET=...             # Optional — require X-Gigi-Key header for /api/chat
DATA_DIR=/var/lib/agata     # Future: SQLite database location
```

## Conventions

- **Server-only modules** (better-sqlite3, native, fs access) live under `src/lib/db/` and use
  `import "@tanstack/react-start/server-only"`. They cannot be imported by client code.
- **RPC server functions** live in `src/lib/api/*.functions.ts` — they use `createServerFn(...)`
  and may be imported from both client and server (TanStack replaces with a client RPC stub at
  build time). Do **not** add the `server-only` marker to these.
- **Shared Zod schemas** live in `src/lib/api/schemas.ts` — importable from both sides.
- **React Query hooks** in `src/lib/api/client.ts` are the canonical way to read/mutate data.
- API routes (file uploads, asset streaming): `createFileRoute("/api/…").server.handlers`.
- Polish UI strings; English code. Match existing file style; new files must be lint/prettier-clean.

## Sandbox constraint note

Changes authored without `npm install` (registry 403 in sandbox). **Verify on the VPS:**

```bash
npm install && npm run build && npm test
```

Expected: `.output/server/index.mjs` produced, 49 tests pass, no Lovable/Supabase errors.

## Phase 1.5 — consumer migration (next)

The 28+ route components under `src/routes/` and the helper libs (`stats.ts`, `effective-books.ts`)
still call `getAllBooks()` / `getAllNotes()` from the localStorage `*-store.ts` modules. To finish
the React Query cutover, each consumer should switch to:

```ts
const books = useBooksQuery(); // was: getAllBooks()
const book = useBookQuery(id); // was: getEffectiveBookById(id)
const update = useUpdateBookMutation(); // was: updateBook(id, patch)
const remove = useDeleteBookMutation(); // was: deleteBook(id)
```

The store modules can be deleted once the last consumer migrates. Until then they remain as a
backwards-compat shim that reads localStorage. **No automatic localStorage → server migration** —
the user will trigger an explicit "Migrate to server" action in Settings (per project rule:
"Import danych ma pokazać liczby do potwierdzenia").
