# Environment variables

> **Direction (2026-06-25):** the app is self-hosted on the VPS with a local **SQLite**
> database and a **paste-on-page OpenAI API key** flow for Gigi. The ChatGPT OAuth
> and Supabase variables have been removed. See
> [`exit-lovable-plan.md`](./exit-lovable-plan.md) and [`local-database-plan.md`](./local-database-plan.md).

## Self-host target (current)

| Variable            | Purpose                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATA_DIR`          | Directory for the SQLite DB + assets on the VPS (default `./data`, prod e.g. `/var/lib/agata`).                     |
| `AGATA_SECRETS_KEY` | AES-256-GCM key (32 random bytes base64) for encrypting user-pasted secrets at rest (the OpenAI key from Settings). |
| `OPENAI_API_KEY`    | Optional env-based OpenAI key. If unset, falls back to the encrypted key in Settings → "Prywatność i dostęp Gigi".  |
| `OPENAI_MODEL`      | Optional model override (default `gpt-5.4-mini`).                                                                   |
| `LOVABLE_API_KEY`   | Optional fallback (Lovable AI gateway, Gemini). Used only if no OpenAI key is available from env or Settings.       |
| `GIGI_SECRET`       | Optional `X-Gigi-Key` header guard for `/api/chat`.                                                                 |
| `PORT` / `HOST`     | Nitro server bind (defaults `3000` / `127.0.0.1`). Reverse-proxied by Caddy on the VPS.                             |

`AGATA_SECRETS_KEY` is the only variable with a hard requirement on the VPS for
the paste-on-page OpenAI key flow — without it, `/api/openai-key/save` returns
`500 missing-encryption-key`. Generate with:

```
openssl rand -base64 32 | sudo tee -a /etc/agata.env
sudo chmod 600 /etc/agata.env && sudo systemctl restart agata
```

## Transitional (no longer in use)

- `GIGI_TOKEN_KEY` — replaced by `AGATA_SECRETS_KEY` (the encrypt-at-rest helper is now
  generic instead of chatgpt-oauth-specific).
- `CHATGPT_OAUTH_CLIENT_ID` / `CHATGPT_OAUTH_REDIRECT_URI` — removed with the OAuth flow.
- `VITE_SUPABASE_*` / `MY_SUPABASE_*` — Supabase was removed entirely.

## Gigi status

`src/routes/gigi.tsx` calls the real `/api/chat` (streaming, real loading/error states)
against the OpenAI provider (`src/lib/gigi/providers/openai.ts`). When neither
`OPENAI_API_KEY` nor a stored user key is configured, the page renders an inline banner
above the chat composer — the composer stays reachable so the user can attempt a send
and read the `notConfiguredMessage` hint that points at Settings.
