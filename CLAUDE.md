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

## Current state (2026-06-24)

- **Responsive layout audit done (commit `d6a5a1a`, on `main`)** — checked mobile (375px),
  tablet (820px), and PC (1280px), fixed 3 layout overflow regressions:
  - Filter `<select>`s in `/notes` + `/quotes` now get
    `min-w-0 max-w-full basis-[calc(50%-0.25rem)] sm:basis-auto sm:max-w-none truncate` so two
    side-by-side selects on mobile never overflow their parent. Contract pinned by
    `src/routes/notes-filter-overflow.spec.tsx`.
  - `AppShell.tsx` main column → `flex flex-col min-h-0` so chat/notes pages that need the
    full viewport height don't clip themselves against `<main>`'s block layout.
  - `src/routes/gigi.tsx` root → `flex-1 flex flex-col min-h-0` (was `h-[100dvh]`) so the
    chat composer pins to the bottom in 100dvh viewports without bleeding past the AppShell.
- **OAuth-first Gigi landing + always-visible Settings (2026-06-24)** — user requirement
  on 2026-06-24: Settings must stay reachable from /gigi, AND ChatGPT OAuth connect must
  appear FIRST (no WELCOME / prompt chips / chat composer until connected). The page now
  reads `useChatgptStatusQuery()` + `getGigiViewState()` (pure decision in
  `src/routes/gigi-view-state.ts`) and renders one of three sub-trees:
  `loading` → spinner, `needs-oauth` → `<ChatGPTConnectCard />` + "Otwórz Ustawienia"
  link, `ready` → existing chat composer. Header action slot always shows a Settings
  chip so Ustawienia is one click away even when the chat UI is gated. Regression tests:
  `src/routes/gigi-view-state.spec.ts` (4) + `src/routes/gigi.spec.ts` (7) +
  `src/lib/api/client.spec.ts` (4). Code-review fix: `useChatgptStatusQuery` now caps
  `retry: 1` (avoid infinite spinner on flaky network) and `ChatGPTConnectCard` calls
  `invalidateChatgptStatus(qc)` after a successful refresh so the /gigi page picks up
  the new state without waiting for `staleTime` to elapse.
  - Regression test: `e2e/mobile-overflow.spec.ts` (9 routes × 2 viewports) — fails CI if any
    route clips horizontally on 375px or 820px.
- **Production-readiness audit done** (commit `d4f0e55`, merged to `main` via `5a65aa7`):
  - Per-field Zod caps on every server-function input schema — closes the import-DoS and chat-DoS
    surfaces. Regression tests in `src/lib/api/schemas.spec.ts`.
  - `src/lib/use-focus-trap.ts` (dependency-free) wired into 4 custom modals (HandwritingCanvas
    ClearConfirm, BackupPanel import-confirm, NoteEditor ConfirmModal, EditBookModal).
  - `/api/chat` parses `messages` with `z.array(ChatMessageSchema).max(50)` BEFORE `buildGigiModel()`,
    and validates `privacyLevel` against a Set of 5 known values (hostile strings fall back to "full").
  - `image/svg+xml` removed from `/api/assets/[id]` mime allowlist (stored-XSS via `<script>` /
    `<foreignObject>`).
  - `gigi.tsx` uses AbortController to cancel streaming fetches on unmount + new-send; swallows
    `AbortError`; uses `crypto.randomUUID()` for message ids.
  - `book-search.ts` unwraps the paginated `Page<T>` API response into a flat array. Regression
    test in `src/lib/book-search.spec.ts`.
  - Skip-to-content link (`<a href="#main">`) in `AppShell`; Polish `sr-only` "Zamknij" on Radix
    dialog/sheet; aria-hidden on decorative icons; aria-label + maxLength on tag chip input.
  - 7 mutating surfaces wrapped in try/catch with `toast.error` and optimistic-state rollback.
  - Verification: `npm test` → 270/270 pass; `npm run typecheck` → 0 errors; two independent
    physical Playwright walkthroughs against the production Nitro server confirmed every screen
    renders and every security cap fires. AGATA-READY for single-user Tailscale deploy.

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
  - `src/routes/api/chatgpt/{login,callback,exchange,status,disconnect,redirect-uri}.ts` — OAuth
    handlers + redirect-uri endpoint:
    - `GET /api/chatgpt/login` → 302 to `auth.openai.com/oauth/authorize?...` with PKCE
      verifier + state stashed in a short-lived `gigi.oauth` httpOnly cookie.
    - `GET /api/chatgpt/callback` → verifies state, exchanges code, persists, redirects to
      `/settings?chatgpt=connected` (or `error&reason=...`).
    - `POST /api/chatgpt/exchange` → mobile/SSH paste-the-URL flow: POSTs `{code,state}` and
      completes the exchange against the same cookie state.
    - `GET /api/chatgpt/status` → `{ connected, accountId?, expiresAt?, hasRefreshToken? }`.
    - `POST /api/chatgpt/disconnect` → clears both settings keys.
    - `GET /api/chatgpt/redirect-uri` → returns the `redirect_uri` ChatGPT should redirect back
      to. Reads `CHATGPT_OAUTH_REDIRECT_URI` from env (defaults to `http://127.0.0.1:3001/...`).
      Used by `ChatGPTConnectCard.tsx` to render a domain-accurate paste-the-URL hint. Resolver
      lives in `src/lib/gigi/oauth-redirect-uri.ts` (4 unit tests).
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
  - systemd `agata.service` runs `node .output/server/index.mjs` on `127.0.0.1:3002`
    (PORT=3002 from `/etc/agata.env` — moved off 3001 because PiperWebsite's vite dev
    auto-bumps to 3001 when 3000 is taken; both apps coexist without a port fight).
  - Caddy reverse-proxies 9443 → 3002 with Tailscale-issued cert (no public CA, no HTTP listener)
  - Data: `/var/lib/agata/agata.db` (750 agata:agata, SQLite WAL); `/etc/agata.env` (600 root)
  - **Port 9443**: sshd owns :443 and nginx owns :80/:8443 (VPS shared with PiperWebsite on :3000);
    caddy uses 9443 to avoid the conflicts. Reachable only over Tailscale VPN — no public exposure.
- **Krok 0.5 — Public HTTPS via Cloudflare Tunnel (live 2026-06-24)** — second front door on
  `https://mycozylibary.com/`. Coexists with the Tailscale URL.
  - `cloudflared` runs as a single token-mode systemd unit (`/etc/systemd/system/cloudflared.service`)
    using the `--token` flag the Cloudflare dashboard mints during tunnel creation. No
    `/etc/cloudflared/config.yml` or credentials JSON — the token encodes tunnel UUID + secret.
  - **This differs from the repo template** (`deploy/cloudflared-agata.service` +
    `deploy/cloudflared-config.example.yml`) which uses credentials-file-mode. The repo
    template is a valid alternative; the VPS uses the simpler token-mode. Keep both paths
    documented — operators may prefer one or the other.
  - Routing is owned by the Cloudflare dashboard (Tunnel → Public Hostnames), **not** the
    config — keeping the agent stateless so a sync error fails loudly instead of silently
    blackholing traffic.
  - Tunnel → `127.0.0.1:3002` (Agata). Cloudflare Access policy gates `/` (email OTP for
    the configured identities). `curl https://mycozylibary.com/api/health` returns HTTP 302
    → Access login (expected for unauthenticated probe).
  - `/etc/agata.env`: `CHATGPT_OAUTH_REDIRECT_URI=https://mycozylibary.com/api/chatgpt/callback`
    so the OAuth callback resolves to the public hostname. Resolver lives in
    `src/lib/gigi/oauth-redirect-uri.ts`; the `/api/chatgpt/redirect-uri` endpoint serves it
    to `ChatGPTConnectCard.tsx` for the paste-the-URL flow.
  - **No app-level auth**: no `GIGI_SECRET`, no rate limiting, no WAF. Single-user trust comes
    from Cloudflare Access (email OTP for the configured identities — Kamil + Agata) +
    obscurity-of-domain-name. Documented in `deploy/README.md` §9.
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
5. Krok 0.5 — Cloudflare Tunnel on `mycozylibary.com` — 📦 repo artefacts shipped (systemd unit,
   config template, README §9, env-driven redirect URI). ⏳ VPS ops pending (`apt install
cloudflared` + `cloudflared login` + dashboard Public Hostname config).
6. ~~Phase 1.5 — React Query cutover~~ ✅ **DONE** (28+ consumers migrated; importer + assets wired)
7. ~~Faza 2 — Gigi via OAuth ChatGPT~~ ✅ **DONE** (PKCE + AES-256 + Settings UI; needs `GIGI_TOKEN_KEY` in `/etc/agata.env`)
8. Ops: monitoring, logrotate, cert rotation (Tailscale auto-rotates; Caddy reload).
9. Phase 3 — Backups, monitoring, more providers as needed.

Full detail: [`docs/exit-lovable-plan.md`](./docs/exit-lovable-plan.md) and
[`docs/local-database-plan.md`](./docs/local-database-plan.md).

## Build / run / verify

```bash
npm install            # required on VPS; this sandbox can't (registry 403)
npm run dev            # vite dev
npm run build          # vite build → .output/server/index.mjs (node-server)
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm test               # node:test via tsx (298 tests: db repos + zod schemas + client surface + asset ids + import round-trip + chatgpt OAuth + library migration + /api/health + isHttpsRequest + chat caps + book-search page unwrap + Gigi OAuth providers + ChatGPT redirect-uri resolver + ChatGPT redirect-uri client fetcher + Gigi view-state machine + /gigi OAuth-first landing + chatgpt-status query surface)
npx playwright test    # e2e: 23 tests (smoke + navigation + real upstream book-search via Open Library / Google Books). Runs against `node .output/server/index.mjs`. For an interactive walkthrough of every screen, use the Playwright MCP browser against `DATA_DIR=/tmp/agata-walk HOST=127.0.0.1 PORT=4174 node .output/server/index.mjs`.
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
CHATGPT_OAUTH_REDIRECT_URI # Optional — public OAuth callback URL. Defaults to the loopback
                           # URL. Set to https://mycozylibary.com/api/chatgpt/callback when
                           # going public behind Cloudflare Tunnel.
GOOGLE_BOOKS_API_KEY=...   # Optional — Google Books API key. WITHOUT this key, GB requests
                           # go through the shared default project (routinely 429-limited
                           # from busy VPS IPs) and the GB second-source cover upgrade in
                           # `enrichCover` silently returns []. WITH this key, requests go
                           # against the operator's own GCP quota (free tier 1000 req/day).
                           # Get one at https://console.cloud.google.com → Enable Books API →
                           # Create API key. Restart agata after setting.
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
  `import "@tanstack/react-start/server-only"`. They cannot be imported by client code. The same
  marker is also applied to server-only SDK wrappers (`src/lib/ai-gateway.server.ts`,
  `src/lib/book-search.server.ts`).
- **RPC server functions** live in `src/lib/api/*.functions.ts` — they use `createServerFn(...)`
  and may be imported from both client and server (TanStack replaces with a client RPC stub at
  build time). Do **not** add the `server-only` marker to these.
- **Shared Zod schemas** live in `src/lib/api/schemas.ts` — importable from both sides. Every
  field is capped via the named helpers (`Tag` 64B, `ShortStr` 256B, `MedStr` 2KB, `LongStr` 20KB,
  `ChatContent` 32KB, ids ≤128). The chat route parses with
  `z.array(ChatMessageSchema).max(50).safeParse(...)` BEFORE `buildGigiModel()` so the cap fires
  even when Gigi is not configured.
- **React Query hooks** in `src/lib/api/client.ts` are the canonical way to read/mutate data.
  Mutations invalidate the per-book key when a `bookId` is present in the payload so detail
  views refetch without a manual reload. `staleTime: 30_000` is set on every list/single query.
- API routes (file uploads, asset streaming): `createFileRoute("/api/…").server.handlers`.
- `/api/assets/[id]` mime allowlist MUST NOT include `image/svg+xml` (stored-XSS via
  `<script>`/`<foreignObject>`). If vector cover art is needed, convert at upload time.
- Custom full-screen modals without Radix `<Dialog>` use `useFocusTrap(ref, onEscape, enabled)`
  from `src/lib/use-focus-trap.ts`. The hook stashes `onEscape` in a `useRef` to avoid
  re-binding the document-level keydown listener on every parent re-render.
- Mutating actions wrap `mutateAsync` calls in `try/catch` with `toast.error(...)` and roll
  back optimistic local state on failure. The pattern is repeated across NoteEditor,
  book.$id, book.$id.read/stats/status, recommendations, and settings TagManagerPanel.
- Polish UI strings; English code. Match existing file style; new files must be lint/prettier-clean.

## Sandbox constraint note

Changes authored without `npm install` (registry 403 in sandbox). **Verify on the VPS:**

```bash
npm install && npm run build && npm test
```

Expected: `.output/server/index.mjs` produced, 298 unit + 23 e2e Playwright tests pass, no Lovable/Supabase errors.

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
