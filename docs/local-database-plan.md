# Local database & storage plan (personal, self-hosted on a VPS)

## Context

Today the app stores everything in the **browser's `localStorage`** (keys `agata-books-v1`,
`agata-book-notes-v1`, `agata-reading-sessions-v1`, drafts, prefs, …; see `src/lib/backup.ts`).
That was fine for a demo but is the wrong long-term home for a personal library you intend to
keep for years:

- **Trapped per-browser** — data lives in one browser profile on one device. You want to use it
  from PC, laptop, iPad and iPhone.
- **Tiny quota** — `localStorage` is ~5–10 MB. Covers, handwriting drawings and page photos are
  stored as base64 data URLs, which is why the app already raises `agata:quota` events.
- **Not durable / not backed up** — clearing site data, a browser reset, or a wiped device loses
  everything. No real backups.

**Decisions captured for this plan:** engine — *my call* (→ **SQLite**); access — *web / PC /
laptop / iPad / iPhone* (→ **multi-device, server-authoritative**); offline — *online-only
(simpler)* (→ no offline sync/conflict logic).

**Goal:** one durable database on the VPS that every device reads/writes over the web, with
file-based backups and almost no ops.

## Recommended architecture

**Server-authoritative SQLite on the VPS**, accessed by all devices over HTTPS. The VPS is the
single source of truth; the browser keeps only a React Query cache (no `localStorage` as primary
store).

```
iPad / iPhone / laptop / PC  ──HTTPS──▶  Caddy (TLS, single-user gate)
                                              │
                                              ▼
                                    Nitro node server (TanStack Start)
                                       ├─ server fns / /api/* (Zod-validated)
                                       ├─ SQLite file:  /var/lib/agata/agata.db   (Drizzle + better-sqlite3)
                                       └─ assets dir:   /var/lib/agata/assets/    (covers, drawings, photos)
```

### Why SQLite (not Postgres)
- **Single personal user** → no concurrency story to engineer. SQLite handles this trivially.
- **Zero-ops & durable** — one file; backup = copy the file. No daemon to run, patch, or tune.
- **Fast** — `better-sqlite3` is synchronous and in-process; perfect for server functions.
- **Portable** — move the VPS or restore on a new box by copying `agata.db` + `assets/`.
- Postgres is the better-multi-user choice (and the relational schema is already sketched in
  `src/lib/supabase-mappers.ts`), but for one person it's pure ops overhead. We keep that schema
  as a reference and can migrate to Postgres later if the app ever goes multi-user — the
  server-side data layer below makes the engine swappable.

### Stack
- **Drizzle ORM + better-sqlite3** — typed schema, generated SQL migrations (`drizzle-kit`),
  trivial queries. Drizzle keeps the engine behind an interface so a future Postgres move is
  contained.
- **TanStack Start server functions** (`createServerFn`) and/or `/api/*` route handlers for the
  data API. **Zod** (already a dependency) validates every payload.
- **TanStack React Query** (already a dependency) on the client for fetching, caching, optimistic
  mutations and invalidation — this replaces the `localStorage` stores.

## Runtime change required (important)

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, whose Nitro build **defaults to the
Cloudflare target**. Cloudflare Workers can't run native modules (`better-sqlite3`) or touch a
filesystem. For the VPS we must build with Nitro's **`node-server`** preset and ensure
`better-sqlite3` is treated as an external/native dependency (not bundled). This is a config
change + a verification build, not a rewrite.

## Data model (single-user)

Reuse the shapes already in `src/lib/mock-data.ts` and the relational design in
`supabase-mappers.ts`, dropping the `user_id`/RLS columns (one owner). Tables:

- `books` — id (text, keep existing `local-…`/uuid ids), title, author, isbn, status, rating,
  cover_asset_id, page_count, current_page, metadata…, created_at, updated_at.
- `notes` — id, book_id (FK), type (`quote|note|page-photo|chapter|other`), content, quote_text,
  page_number, chapter_*, input_mode, drawing_asset_id, photo_asset_id, background, tags (JSON),
  is_favourite, created_at, updated_at.
- `reading_sessions` — id, book_id, date, minutes, start_page, end_page, pages_read.
- `goals`, `settings` (incl. Gigi privacy level + the new `preferences`), `assets` (see below).
- `note_drafts` can stay client-side (ephemeral) or move to a `drafts` table — low priority.

Tags: store as a JSON array column; the new "Zarządzaj tagami" panel already edits tags through
the store functions, so it keeps working once those functions call the server.

## Binary assets (covers, drawings, page photos) — fix the bloat

Stop storing images as base64. Instead:
- Upload endpoint writes the decoded bytes to `/var/lib/agata/assets/<sha256>.<ext>`
  (content-addressed → automatic dedupe), inserts an `assets` row (id, path, mime, bytes,
  created_at), and returns the asset id.
- DB rows reference `*_asset_id`; the client renders `/assets/:id` (a Nitro route streaming the
  file, with long cache headers). Keeps the DB small and makes image backup a simple `tar`.

## Client data layer (replaces the `localStorage` stores)

The store modules (`books-store.ts`, `notes-store.ts`, `book-workspace-store.ts`, `goals-store.ts`)
expose a clean API (`getAllBooks`, `createBook`, `updateBook`, `deleteBook`, `useBooksVersion`, …)
that the whole UI already uses. We re-implement that layer on React Query:

- Reads: `useBooks()`, `useNotes(bookId)`, etc. → `useQuery` hitting the server fns.
- Writes: `createBook`/`updateBook`/… → `useMutation` with **optimistic updates** + cache
  invalidation, so the UI stays as snappy as it is now.
- The `useXVersion()` hooks are retired in favour of query keys; components switch from
  "read synchronously + version tick" to "consume the query result". This is the **largest part
  of the work** — it touches every data-bound route/component — but it's mechanical and the store
  interface gives a clear seam.

Online-only keeps this simple: no merge/conflict logic, no background sync queue. React Query's
stale-while-revalidate + refetch-on-focus already makes multi-device feel live.

## Migration (one-time, no data loss)

`src/lib/backup.ts` already produces a complete `AgataBackup` JSON (books, notes, sessions, goals,
prefs, drafts, plus any extra `agata-*` keys). Migration path:

1. On the current app, **export a backup** (existing button) — or read `localStorage` directly.
2. Add a one-time **import endpoint** that accepts that JSON, decodes base64 images into the
   assets dir, and inserts rows into SQLite (idempotent on ids).
3. Verify counts (books/notes/sessions) match `getLocalCounts()` before cutting over.

## Security (single user, in-app login stays hidden)

You want no login UI. Don't put app-level auth in the React app; protect at the edge instead:
- **Recommended: Tailscale** (or WireGuard) — the VPS is only reachable from your own devices;
  the app needs no auth at all. Simplest and strongest for personal use.
- **Or: Caddy basic-auth** in front of the app for public-internet access over TLS.
- Defence in depth: the data API also checks a server-side shared secret (env var) so the DB is
  never writable without it, even if the app is exposed.

## Backups (the whole point of leaving localStorage)

- **Nightly cron**: `sqlite3 /var/lib/agata/agata.db ".backup '/var/backups/agata/agata-$(date +%F).db'"`
  + `tar czf /var/backups/agata/assets-$(date +%F).tgz -C /var/lib/agata assets`; rotate ~30 days.
- **Offsite**: `rsync`/`rclone` the backup dir to another host or object storage.
- **Optional continuous**: [Litestream](https://litestream.io) streams SQLite to S3-compatible
  storage for point-in-time recovery.
- Keep the in-app **JSON export/import** as a portable, engine-independent logical backup.

## Deployment on the VPS

1. `vite build` with the **node-server** Nitro preset → `.output/` (Node server).
2. Run `.output/server/index.mjs` under **systemd** (auto-restart), env: `DATA_DIR=/var/lib/agata`,
   `LOVABLE_API_KEY`, `APP_SECRET`, etc. `/var/lib/agata` on a persistent disk.
3. **Caddy** (or nginx) reverse proxy terminating TLS (Let's Encrypt) → the Node port; add the
   single-user gate here.
4. Run `drizzle-kit migrate` on deploy to apply schema migrations.

## Phased delivery

- **P0 — Runtime & DB foundation:** switch Nitro to node-server, add Drizzle + better-sqlite3,
  define schema + first migration, create the `DATA_DIR` layout. (verify a build runs)
- **P1 — Server data API:** server fns / `/api/*` for books, notes, sessions, goals, settings —
  Zod-validated, engine behind a repository module.
- **P2 — Assets pipeline:** upload + `/assets/:id` serving; switch covers/drawings/photos off
  base64.
- **P3 — Client cutover:** reimplement the store layer on React Query (queries + optimistic
  mutations); retire `localStorage` as primary store.
- **P4 — Migration importer:** import the existing backup/localStorage into SQLite; verify counts.
- **P5 — Ops:** systemd + Caddy + TLS + nightly backups (+ optional Tailscale / Litestream).

## Risks & notes
- **Biggest effort is P3** (touching every data-bound component). The existing store interface and
  React Query make it mechanical, but it's broad — worth doing entity-by-entity (books → notes →
  sessions → goals).
- **`better-sqlite3` is native** — must be external in the Nitro/node build and present in the
  deploy (`npm rebuild` on the VPS architecture).
- **Cloudflare target is abandoned for this app** by design — node-server is required for
  SQLite + filesystem. Don't deploy this build to Workers.
- Keep `mock-data.ts` types/helpers; they become the shared domain types the server and client
  both import.
