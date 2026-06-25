# Exit Lovable & self-host

Goal: make the app fully self-owned on the VPS with **no Lovable runtime or services**.
Decisions (owner-confirmed): **remove Supabase** (go all-SQLite), **replace the Lovable AI gateway**
behind Gigi with a **paste-on-page OpenAI API key** (Settings → "Prywatność i dostęp Gigi"; the
key is encrypted at rest with `AGATA_SECRETS_KEY`), and **eject the Lovable Vite wrapper**. Chat
stays present app-wide and shows a small banner when no key is configured.

> **Historical note (2026-06-25):** the original "Sign in with ChatGPT" plan (Phase 4 below,
> Codex OAuth PKCE via the public `app_EMoamEEZ73f0CkXaXp7hrann` client id) was **abandoned** in
> favour of the simpler paste-on-page OpenAI API key. The Codex OAuth flow required a one-time
> "connect" on the VPS host, had ToS-gray reuse of the Codex public client, and was an
> undocumented endpoint that could break at any time. The new flow uses the official
> `platform.openai.com` API key, is user-pasted, and ships with a Settings UI. The implementation
> plan lives at `docs/superpowers/plans/2026-06-25-openai-api-key.md`. The ChatGPT-OAuth
> research below is kept for historical reference only.

## Lovable touchpoints (inventory)

- `@lovable.dev/vite-tanstack-config` → `vite.config.ts` (build wrapper). **Active.**
- `@lovable.dev/cloud-auth-js` + `src/integrations/lovable/` → **REMOVED** (was dead code).
- `src/lib/lovable-error-reporting.ts` → **REMOVED** (was dead code).
- Lovable AI gateway: `src/lib/ai-gateway.server.ts` + `LOVABLE_API_KEY` in `src/routes/api/chat.ts`. **Active.**
- Lovable-Cloud Supabase: `src/integrations/supabase/*`, `src/lib/supabase-mappers.ts`,
  `src/lib/cloud-sync.ts`, Supabase parts of `src/lib/auth-context.tsx`. **Active.**
- `AGENTS.md` Lovable banner; `.lovable/` dir.

## Research: how "Sign in with ChatGPT" works

Confirmed from OpenAI Codex auth docs + the Zed and opencode implementations:

- **OAuth 2.0 + PKCE.** Authorize `https://auth.openai.com/oauth/authorize`, token
  `https://auth.openai.com/oauth/token`. Uses OpenAI's **Codex public client_id**
  `app_EMoamEEZ73f0CkXaXp7hrann`. Loopback callback `http://localhost:1455/auth/callback`.
  Scope includes `offline_access` (→ refresh token). Access tokens auto-refresh ~5 min before expiry.
- The access-token **JWT carries a `ChatGPT-Account-Id`**. Model calls go to
  **`https://chatgpt.com/backend-api/codex/responses`** (Responses API) with headers
  `Authorization: Bearer <token>`, `ChatGPT-Account-Id: <id>`, `originator: <app>`,
  `OpenAI-Beta: responses=experimental`, and body `store: false`. Usage is **billed to the ChatGPT
  subscription**. Model set is limited to the Codex/Responses surface.
- **Caveats (important):** reuses Codex's client_id (ToS-gray), undocumented endpoint (can break),
  limited models, and the loopback callback is desktop-oriented — so the **one-time "connect" runs
  on the VPS host** (SSH-forward `localhost:1455`, or a paste-the-code flow), not from the
  iPad/phone browser. Isolate all of this behind one server module so it can be swapped for an
  official API-key provider if it breaks.

Sources:

- OpenAI Codex auth — https://developers.openai.com/codex/auth
- Zed PR #56811 (ChatGPT subscription provider via OAuth 2.0 PKCE) — https://github.com/zed-industries/zed/pull/56811
- opencode #3281 (ChatGPT OAuth sign-in) — https://github.com/anomalyco/opencode/issues/3281

## Phases (each independently shippable)

### Phase 1 — Eject the Vite config

Rewrite `vite.config.ts` as a plain config composing standard plugins (all already deps):
`tanstackStart()` (`@tanstack/react-start/plugin/vite`) targeting **node-server**, `viteReact()`
(`@vitejs/plugin-react`), `tailwindcss()` (`@tailwindcss/vite`), `tsConfigPaths()`
(`vite-tsconfig-paths`, gives the `@/*` alias). Standard Vite already exposes `VITE_*` env. Keep
`src/server.ts`. Pin the Nitro **node-server** preset (start-plugin target option or
`NITRO_PRESET=node-server` — confirm against the installed `@tanstack/react-start`). Remove devDep
`@lovable.dev/vite-tanstack-config`. Update `AGENTS.md` (drop the Lovable banner). **Verify with a
real `npm run build`.**

### Phase 2 — Delete dead Lovable code ✅ DONE

`src/integrations/lovable/`, `src/lib/lovable-error-reporting.ts`, dep `@lovable.dev/cloud-auth-js`
removed (all were unreferenced).

### Phase 3 — Remove Supabase → SQLite foundation (P0)

Per [`local-database-plan.md`](./local-database-plan.md): add `drizzle-orm` + `better-sqlite3`
(+`drizzle-kit`, `@types/better-sqlite3`); `src/lib/db/{schema,client,index}.ts` (server-only),
`drizzle.config.ts`, migrations, `DATA_DIR`, `/api/db-health`. Fallback to Node 22's built-in
`node:sqlite` if Nitro can't bundle the native binary. Then delete `src/integrations/supabase/*`,
`supabase-mappers.ts`, `cloud-sync.ts`, Supabase parts of `auth-context.tsx`, and dep
`@supabase/supabase-js`. `.gitignore`: add `/data/`, `*.db*`.

### Phase 4 — Gigi → Sign in with ChatGPT

Delete `src/lib/ai-gateway.server.ts`; add `src/lib/openai-chatgpt.server.ts` (OAuth PKCE flow,
encrypted token store in SQLite `settings`/`DATA_DIR`, auto-refresh, `streamChatGPT(messages)` →
`chatgpt.com/backend-api/codex/responses`). Rewrite `src/routes/api/chat.ts` to use it (no
`LOVABLE_API_KEY`, pull any book/note context from SQLite). Add connect routes
(`/api/chatgpt/login` + callback) and a "Połącz ChatGPT" action in Settings; connect once on the
host. Gigi stays present app-wide, shows the connect prompt until a token exists.

### Phase 5 — Data cutover (P1 + P3) and ops (P2/P4/P5)

Server CRUD API for books/notes/sessions/goals/settings (P1); client React-Query hooks replacing
the `localStorage` stores (P3); assets pipeline off base64 (P2); one-time importer from the
existing backup JSON (P4); systemd + Caddy/TLS + nightly SQLite backups, optional Tailscale (P5).

## Done-when (full exit)

`grep -ri lovable src vite.config.ts package.json` → no matches; `npm run build` (node-server)
produces `.output/server/index.mjs` that boots with **no** `LOVABLE_*`/`SUPABASE_*` env; data on
SQLite; Gigi works after the one-time ChatGPT connect.
