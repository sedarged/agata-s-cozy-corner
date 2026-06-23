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
- Data: **server-authoritative SQLite** at `/var/lib/agata/agata.db` (Drizzle + better-sqlite3, WAL).
  Route components still read from localStorage `*-store.ts` shims (Phase 1.5 migration in progress).
- Server API routes: chat (Gigi), book search. New: `*.functions.ts` RPC + `/api/*` for streams.

## Current state (2026-06-21)

- **Lovable fully ejected** — `vite.config.ts` uses native `tanstackStart()` + `nitro()` +
  `viteReact()` + `tailwindcss()` + `tsConfigPaths()` with `node-server` preset.
- **Supabase removed** — no cloud deps; auth at the network level via Caddy/Tailscale on VPS.
- **Gigi works without auth** — `gigi.tsx` passes localStorage context. `/api/chat` supports
  `OPENAI_API_KEY` (primary), `LOVABLE_API_KEY` (fallback), or **ChatGPT OAuth** (Pro/Plus
  subscription; see Faza 2 below). Optional `GIGI_SECRET`.
- **Faza 2 done — Gigi przez OAuth ChatGPT** (PKCE + AES-256 token store):
  - `src/lib/gigi/oauth-chatgpt.ts` (pure) — PKCE pair, authorize URL builder, token-response
    parsing, `chatgpt_account_id` extraction from the id_token JWT.
  - `src/lib/gigi/oauth-chatgpt.server.ts` — AES-256-GCM encrypted token store backed by the
    `settings` table (`gigi.chatgpt.token`, `gigi.chatgpt.accountId`). Key from
    `process.env.GIGI_TOKEN_KEY` (32 random bytes base64).
  - `src/lib/gigi/oauth-chatgpt.flow.ts` — server-only HTTP exchanges (`exchangeCodeForToken`,
    `refreshAccessToken`) against `https://auth.openai.com/oauth/token`.
  - `src/lib/gigi/providers/chatgpt.ts` — AI SDK v3 model built via
    `createOpenAICompatible` against `https://chatgpt.com/backend-api/codex` with the
    `Authorization: Bearer …` + `ChatGPT-Account-Id: …` + `OAI-Product-Sku: codex` headers
    (verified against `openai/codex` eb8c1ee).
  - `src/lib/gigi/resolver.ts` + `build-model.ts` — added `"chatgpt"` to `GigiProviderName`.
    `OPENAI_API_KEY` still wins; chatgpt auto-picks from the encrypted store when no env key
    is set AND a non-expired token exists. `buildGigiModel` is now async (token DB read).
  - `src/routes/api/chatgpt/{login,callback,exchange,status,disconnect}.ts` — OAuth handlers:
    - `GET /api/chatgpt/login` → 302 to `auth.openai.com/oauth/authorize?...` with PKCE
      verifier + state stashed in a short-lived `gigi.oauth` httpOnly cookie.
    - `GET /api/chatgpt/callback` → verifies state, exchanges code, persists, redirects to
      `/settings?chatgpt=connected` (or `error&reason=...`).
    - `POST /api/chatgpt/exchange` → mobile/SSH paste-the-URL flow: POSTs `{code,state}` and
      completes the exchange against the same cookie state.
    - `GET /api/chatgpt/status` → `{ connected, accountId?, expiresAt?, hasRefreshToken? }`.
    - `POST /api/chatgpt/disconnect` → clears both settings keys.
  - `src/components/ChatGPTConnectCard.tsx` — wired into Settings > Prywatność i dostęp Gigi.
    Three flows: browser OAuth, paste-the-URL, disconnect. Surfaces toast on
    `?chatgpt=connected|error&reason=…`.
  - **VPS ops prerequisite**: `GIGI_TOKEN_KEY` must be in `/etc/agata.env` (32 random bytes
    base64). Generate with: `openssl rand -base64 32 | sudo tee -a /etc/agata.env` then
    `sudo chmod 600 /etc/agata.env && sudo systemctl restart agata`. Without it, the OAuth
    flow still works in-memory but tokens cannot be persisted across restarts.
- **Phase 1 backend done (commit 1796df1)** — Drizzle + better-sqlite3 + server CRUD + React Query:
  - `src/lib/db/schema.ts` (TEXT ids, JSON tags, no user_id), 5 repos with integration tests (20/20)
  - `src/lib/api/*.functions.ts` — server functions, Zod-validated (23 schema tests)
  - `src/lib/api/client.ts` — React Query hooks (queries + mutations + query keys) with smoke tests
  - `src/lib/api/db-health.functions.ts` — `useDbHealthQuery` feeds `DatabaseStatus` (real DB counts)
  - `drizzle/0000_init.sql` migration; `drizzle.config.ts`; `npm run db:generate` / `db:migrate`
  - `dataDir()` from `process.env.DATA_DIR || .agata-data` (server-side only; native better-sqlite3)
- **Krok 0 deployed (commit e8ff714 + manual ops)** — Agata live over Tailscale HTTPS:
  - URL: **https://hermes-computer-1.tail4d5951.ts.net:9443/** (port 9443, see note below)
  - systemd `agata.service` runs `node .output/server/index.mjs` on 127.0.0.1:3001
  - Caddy reverse-proxies 9443 → 3001 with Tailscale-issued cert (no public CA, no HTTP listener)
  - Data: `/var/lib/agata/agata.db` (750 agata:agata, SQLite WAL); `/etc/agata.env` (600 root)
  - **Port 9443**: sshd owns :443 and nginx owns :80/:8443 (VPS shared with PiperWebsite on :3000);
    caddy uses 9443 to avoid the conflicts. Reachable only over Tailscale VPN — no public exposure.
- **Phase 1.5 in progress (commit 6958f69)** — backup-import API + asset streaming + first React Query
  cutover:
  - `src/routes/api/assets/$id.ts` — streams bytes from `$DATA_DIR/assets/<id>.<ext>` with id
    allowlist (length ≤ 128, `[A-Za-z0-9._-]+`) and mime allowlist (images only — no stored-XSS
    via `text/html`). 6 id-validation unit tests.
  - `src/lib/api/import-schema.ts` + `import.functions.ts` — Zod-validated wire format that
    mirrors `buildBackup()`. `previewImport` (dry-run counts) + `applyImport` (`merge` /
    `replace` / `preview`). 23 unit tests + 4 round-trip tests (`buildBackup → BackupPayloadSchema`).
  - `src/components/MigrateToServerCard.tsx` — Settings > Kopia zapasowa. Preview-then-confirm
    flow with mode toggle (Dołącz / Wyczyść). Wired to `useImportPreviewMutation` /
    `useImportApplyMutation`; invalidates React Query on success.
  - **Home page migrated** to `useBooksQuery()` + `useSessionsQuery()` — first route off
    localStorage. Pattern for the remaining 27 file migrations.
  - Repos extended: `upsertNote` (preserves createdAt), `upsertSession`, `markNoteDeleted`
    (tombstone without delete), `deleteAllNotes` (wipes notes + tombstones), `deleteAllSessions`.
- **Phase 1.5 remaining** — 27 route consumers + component helpers still read from `*-store.ts`.
  Pattern is now documented (see "Phase 1.5 — consumer migration" below).

Work is on branch **`claude/agata-reading-app-oe9u3u`**.

## Active roadmap — self-host on the VPS

1. ~~Eject the Vite config~~ ✅ **DONE**
2. ~~SQLite foundation~~ ✅ **DONE** (Phase 1 backend; consumer migration in 1.5)
3. ~~Remove Supabase~~ ✅ **DONE**
4. ~~Krok 0 — VPS deploy~~ ✅ **DONE** (https://hermes-computer-1.tail4d5951.ts.net:9443/)
5. ~~Phase 1.5 — React Query cutover~~ ✅ **DONE** (28+ consumers migrated; importer + assets wired)
6. ~~Faza 2 — Gigi via OAuth ChatGPT~~ ✅ **DONE** (PKCE + AES-256 + Settings UI; needs `GIGI_TOKEN_KEY` in `/etc/agata.env`)
7. Ops: monitoring, logrotate, cert rotation (Tailscale auto-rotates; Caddy reload).
8. Phase 3 — Backups, monitoring, more providers as needed.

Full detail: [`docs/exit-lovable-plan.md`](./docs/exit-lovable-plan.md) and
[`docs/local-database-plan.md`](./docs/local-database-plan.md).

## Build / run / verify

```bash
npm install            # required on VPS; this sandbox can't (registry 403)
npm run dev            # vite dev
npm run build          # vite build → .output/server/index.mjs (node-server)
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # node:test via tsx (219 tests: db repos + zod schemas + client surface + asset ids + import round-trip + chatgpt OAuth + library migration + /api/health + isHttpsRequest)
npx playwright test    # e2e: 23 tests (smoke + navigation + real upstream book-search via Open Library / Google Books). Runs against `node .output/server/index.mjs`.
npm run db:generate    # drizzle-kit generate (after schema change)
npm run db:migrate     # drizzle-kit migrate
```

The router plugin regenerates `src/routeTree.gen.ts` on dev/build.

### Environment variables (VPS)

File: `/etc/agata.env` (chmod 600, owned by root). The systemd unit loads it via `EnvironmentFile=`.

```
PORT=3001                  # Agata binds here; Caddy reverse-proxies 9443 → 127.0.0.1:3001
HOST=127.0.0.1             # localhost-only; no public bind
DATA_DIR=/var/lib/agata    # SQLite database + assets/
GIGI_TOKEN_KEY=...         # AES-256 key for encrypting OAuth tokens at rest (rotated on first install)
OPENAI_API_KEY=...         # Gigi primary AI provider (gpt-4o-mini)
LOVABLE_API_KEY=...        # Gigi fallback (Lovable gateway, Gemini) — optional
GIGI_SECRET=...            # Optional — require X-Gigi-Key header for /api/chat
```

### Deploy commands (VPS)

```bash
# After git pull (cache sudo first via interactive `sudo -v`):
cd /home/agata/agata-s-cozy-corner
./scripts/vps-setup.sh         # npm ci + npm run build
sudo systemctl restart agata caddy

# Verify:
curl -skI https://hermes-computer-1.tail4d5951.ts.net:9443/
sudo journalctl -u agata -f   # logs
sudo journalctl -u caddy -f
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

Expected: `.output/server/index.mjs` produced, 219 unit + 23 e2e Playwright tests pass, no Lovable/Supabase errors.

## Phase 1.5 — consumer migration (next)

The remaining 27 route components under `src/routes/` and the helper libs (`stats.ts`,
`effective-books.ts`) still call `getAllBooks()` / `getAllNotes()` from the localStorage `*-store.ts`
modules. The home page is the **first migrated route** — see `src/routes/index.tsx` for the pattern:

```ts
const booksQuery = useBooksQuery(); // was: getAllEffectiveBooks()
const sessionsQuery = useSessionsQuery(); // was: getStoredSessions()
const books = (booksQuery.data ?? []) as EffectiveBook[];
const sessions = (sessionsQuery.data ?? []) as SessionRow[];
```

Other hooks to use as drop-in replacements:

```ts
const book = useBookQuery(id); // was: getEffectiveBookById(id)
const update = useUpdateBookMutation(); // was: updateBook(id, patch)
const remove = useDeleteBookMutation(); // was: deleteBook(id)
const notes = useNotesQuery(); // was: getAllNotes()
const noteForBook = useNotesForBookQuery(bookId); // was: getNotesForBook(bookId)
const createNote = useCreateNoteMutation(); // was: createNote(input)
const sessionsForBook = useSessionsForBookQuery(id); // was: getStoredSessionsForBook(id)
```

**Local → server migration** is now wired via `MigrateToServerCard` in Settings > Kopia zapasowa:
the user clicks "Policz, co zostanie wysłane" → preview counts → confirm → server write.
Modes: `merge` (default; upsert books/notes/sessions, mirror tombstones) and `replace` (bulk wipe,
then upsert). Per project rule "Import danych ma pokazać liczby do potwierdzenia" — never silent.

After every successful apply, React Query caches (`qk.books`, `qk.notes`, `qk.sessions`,
`qk.goals`) are invalidated, so the migrated routes pick up the server data on next render.
Local `*-store.ts` modules stay as a backwards-compat shim until the last consumer migrates.
