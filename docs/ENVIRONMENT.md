# Environment variables

> **Direction (2026-06-20):** the app is moving to a self-hosted VPS setup with a local **SQLite**
> database and a **Sign-in-with-ChatGPT** model connection for Gigi. The Supabase and
> `LOVABLE_API_KEY` variables below are **transitional** and will be removed. See
> [`exit-lovable-plan.md`](./exit-lovable-plan.md) and [`local-database-plan.md`](./local-database-plan.md).

## Planned (self-host target)

| Variable          | Purpose                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA_DIR`        | Directory for the SQLite DB + assets on the VPS (default `./data`, prod e.g. `/var/lib/agata`).                                                     |
| `APP_SECRET`      | Server-side secret guarding write APIs (defence-in-depth behind the reverse proxy).                                                                 |
| _(ChatGPT OAuth)_ | No API key — Gigi connects via OAuth to the personal ChatGPT subscription; tokens are stored server-side in `DATA_DIR`. See `exit-lovable-plan.md`. |

## Transitional (current — being removed)

Agata runs fully **local-first** with no required runtime secrets. The
variables below are only needed for the _optional_ cloud / Gigi features,
which are gated off by default.

## Client (Vite — safe to expose, anon only)

| Variable                        | Required           | Purpose                                                  |
| ------------------------------- | ------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | for cloud features | Supabase project URL (used by the in-app DB diagnostic). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | for cloud features | Supabase anon/publishable key. RLS-scoped; safe to ship. |

`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are accepted as fallbacks.

## Server (never shipped to the client)

| Variable                                                     | Required         | Purpose                                                                                         |
| ------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------- |
| `MY_SUPABASE_URL` / `SUPABASE_URL`                           | server functions | Supabase URL for server-side checks.                                                            |
| `MY_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`   | `/api/chat`      | Anon key used with the caller's bearer token (RLS applies).                                     |
| `MY_SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | DB status only   | Admin key for the diagnostic (bypasses RLS — keep secret).                                      |
| `LOVABLE_API_KEY`                                            | **future Gigi**  | AI gateway key. While unset, `/api/chat` returns `503` and Gigi runs as a local mock companion. |

## Gigi status

`src/routes/gigi.tsx` now calls the real `/api/chat` (streaming, real loading/error states), but
chat is **gated behind hidden auth** (`SHOW_AUTH_UI = false`) and the backend still routes through
the Lovable AI gateway (`LOVABLE_API_KEY`). The plan is to replace that gateway with a
**Sign-in-with-ChatGPT** OAuth connection to Agata's personal subscription (no API key) — see
[`exit-lovable-plan.md`](./exit-lovable-plan.md). Until connected, Gigi stays visible app-wide and
shows a "connect" state.
