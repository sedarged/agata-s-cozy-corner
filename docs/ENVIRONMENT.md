# Environment variables

Agata runs fully **local-first** with no required runtime secrets. The
variables below are only needed for the *optional* cloud / Gigi features,
which are gated off by default.

## Client (Vite — safe to expose, anon only)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | for cloud features | Supabase project URL (used by the in-app DB diagnostic). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | for cloud features | Supabase anon/publishable key. RLS-scoped; safe to ship. |

`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are accepted as fallbacks.

## Server (never shipped to the client)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MY_SUPABASE_URL` / `SUPABASE_URL` | server functions | Supabase URL for server-side checks. |
| `MY_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | `/api/chat` | Anon key used with the caller's bearer token (RLS applies). |
| `MY_SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | DB status only | Admin key for the diagnostic (bypasses RLS — keep secret). |
| `LOVABLE_API_KEY` | **future Gigi** | AI gateway key. While unset, `/api/chat` returns `503` and Gigi runs as a local mock companion. |

## Gigi status

Gigi is intentionally a **mock companion** today — no login, no network. The
real model is planned to connect later via a personal ChatGPT OAuth flow.
`/api/chat` + `src/lib/ai-gateway.server.ts` are kept ready for that, but the
UI (`src/routes/gigi.tsx`) does not depend on them yet.
