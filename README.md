# Agata

A private, single-user reading companion. Agata helps one person keep a personal
library of books, take notes and quotes while reading, log reading sessions,
rate and shelve books, and chat with a small AI assistant ("Gigi") about
the things on their nightstand.

Polish UI, English code, zero accounts, zero cloud lock-in.

## Features

- **Library** — manually add books or look them up (Google Books, Open Library,
  ISBN search with a ranking stage).
- **Notes & quotes** — structured notes per book, dedicated quote view, chapter
  notes, free-form handwriting canvas.
- **Reading sessions** — log progress, track pace, see your history.
- **Stats & recommendations** — derived from your library, no profiling.
- **Gigi** — an AI chat assistant that knows your library and can answer
  questions about what you've read. Bring your own key.

## Stack

- **App**: [TanStack Start](https://tanstack.com/start) + React 19 + Vite,
  Tailwind v4 + Radix UI + lucide-react.
- **Data**: server-authoritative SQLite via Drizzle + better-sqlite3 (WAL).
  Client uses TanStack Query for all reads/writes.
- **Server**: Nitro (Node), runs as a single binary.
- **Routing**: file-based via TanStack Router.
- **AI**: OpenAI-compatible HTTP (paste-your-key UI in Settings; the server
  itself can hold an operator-provided key in its environment).
- **Tests**: Vitest unit suite (`npm test`) + Playwright e2e (`npx playwright test`).
- **Lint/format**: ESLint + Prettier.

## Run it

```bash
npm install
npm run dev               # vite dev server with HMR
npm run build             # production server build → .output/server/index.mjs
npm test                  # vitest unit suite
npx playwright test       # e2e suite (against the production build)
```

## Environment

Server-side, optional. See `.env.example` for the full set. Common keys:

| Key                                | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `PORT` (default `3001`)            | Where the server listens.                                                    |
| `HOST` (default `127.0.0.1`)       | Bind address.                                                                |
| `DATA_DIR` (default `.agata-data`) | SQLite + uploaded assets.                                                    |
| `OPENAI_API_KEY`                   | Primary key for Gigi (server-held).                                          |
| `LOVABLE_API_KEY`                  | Optional fallback provider.                                                  |
| `AGATA_SECRETS_KEY`                | AES-256 key (base64, 32 bytes) used to encrypt any user-pasted keys at rest. |
| `GOOGLE_BOOKS_API_KEY`             | Optional, raises Google Books quota from the shared pool to your own.        |

Every environment variable is **optional** — without keys the app still runs;
Gigi will just tell you it's not configured.

## Deployment

Agata is a self-hosted, single-binary Nitro server. The `deploy/` directory
ships opinionated templates (systemd unit, Caddy reverse proxy, Cloudflare
Tunnel config) and a `deploy/README.md` with the full walkthrough. The app
expects to live behind HTTPS and behind whatever access control you prefer
(Tailscale, basic auth, Cloudflare Access, …). There is no in-app login —
the boundary is the network.

## Privacy by design

- One user, no telemetry, no analytics, no third-party calls except the
  providers you opt into (book-search, AI chat).
- All your reading data lives on your server, not in someone else's cloud.
- The Paste-on-page OpenAI key is encrypted at rest with AES-256-GCM.
- See `docs/SECURITY_AND_PRIVACY.md` for the threat model.

## Project layout

```
src/
  routes/           TanStack Router file routes (UI pages + /api routes)
  components/       React components, grouped by feature
  lib/
    db/             Server-only: Drizzle schema + better-sqlite3 repos
    api/            RPC server functions + Zod-validated wire formats
    gigi/           Gigi chat (resolver, model picker, streaming glue)
    openai-key-store.server.ts    Encrypted key storage
  routes/api/       Upload + asset streaming endpoints

drizzle/            SQL migrations
deploy/             VPS deploy artefacts (systemd, Caddy, Cloudflare)
docs/               Architecture, data model, deploy, security notes
e2e/                Playwright e2e tests
```

## License

Personal project. Not currently licensed for redistribution.
