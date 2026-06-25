# Replace ChatGPT OAuth with paste-on-page OpenAI API key

**Date:** 2026-06-25
**Status:** approved
**Scope:** Remove the entire ChatGPT OAuth (Codex) flow + add a Settings UI for
pasting an OpenAI API key. Gigi continues to work exactly as today: streaming
chat with library context, Polish system prompt, AbortController on unmount.

## Decisions

- **Storage:** encrypted at rest in `settings` table (AES-256-GCM, same crypto
  stack the OAuth tokens used). Encryption key from `process.env.AGATA_SECRETS_KEY`
  (32 random bytes base64).
- **Precedence:** `OPENAI_API_KEY` env var wins. The stored UI key is only used
  when env is unset.
- **Model picker:** dropdown in UI with `gpt-5.4-mini` as default plus
  `gpt-5`, `gpt-5-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o-mini`. Stored
  selection persists alongside the key.
- **`/gigi` UX:** no OAuth-style gate. Chat renders normally; if no key is
  configured (env or UI) a small banner at the top points at Settings. The
  existing 503 toast stays as a fallback when the user tries to send anyway.

## Files removed

OAuth / Codex-only paths go away entirely:

- `src/lib/gigi/oauth-chatgpt.ts`
- `src/lib/gigi/oauth-chatgpt.flow.ts`
- `src/lib/gigi/oauth-chatgpt.server.ts`
- `src/lib/gigi/oauth-redirect-uri.ts`
- `src/lib/gigi/oauth-redirect-uri-client.ts`
- `src/lib/gigi/providers/chatgpt.ts`
- `src/routes/api/chatgpt/login.ts` (+ `.spec.ts`)
- `src/routes/api/chatgpt/callback.ts`
- `src/routes/api/chatgpt/exchange.ts`
- `src/routes/api/chatgpt/disconnect.ts`
- `src/routes/api/chatgpt/status.ts`
- `src/routes/api/chatgpt/redirect-uri.ts`
- `src/components/ChatGPTConnectCard.tsx`
- `src/components/chatgpt-connect-card.helpers.ts` (+ `.spec.ts`)
- `src/routes/gigi-view-state.ts` (+ `.spec.ts`)

Plus the existing `.spec.ts` for `oauth-chatgpt*.ts`, `oauth-redirect-uri*.ts`,
`providers/chatgpt.ts`. (`oauth-chatgpt-refresh.spec.ts`,
`oauth-chatgpt.server.spec.ts`, `oauth-chatgpt.flow.spec.ts`,
`oauth-chatgpt.spec.ts`, `oauth-redirect-uri.spec.ts`,
`oauth-redirect-uri-client.spec.ts`, `providers/chatgpt.spec.ts`.)

From `src/lib/api/client.ts` remove: `qk.chatgptStatus`,
`useChatgptStatusQuery`, `invalidateChatgptStatus`, the `ChatgptStatus`
interface.

From `src/lib/gigi/resolver.ts` remove: `chatgpt` from
`GigiProviderName`, the `"chatgpt"` branches in both explicit and implicit
precedence, the `notConfiguredMessage` mention of "połącz konto ChatGPT".
Update `OPENAI_MODEL` default to `gpt-5.4-mini`.

From `src/lib/gigi/build-model.ts` remove: `tryBuildChatGPTFromStore`,
`buildChatGPTModel` import, `StoredToken` import, the `"chatgpt"` switch
case. Add a `tryBuildOpenAIFromStore` that reads the encrypted key from
the settings store and falls back to env-only when nothing is stored.

From `src/routes/gigi.tsx` remove: `useChatgptStatusQuery`,
`getGigiViewState`, `GigiLoading`, `GigiOAuthGate`, the `viewState` branch.
Add: `useOpenAIKeyStatusQuery`, a `<GigiNoKeyBanner />` that renders only
when `!configured`.

From `src/routes/settings.tsx` replace `<ChatGPTConnectCard />` with
`<OpenAIKeyCard />` in the "Prywatność i dostęp Gigi" section.

Docs: drop OAuth sections from `CLAUDE.md`, `deploy/README.md`,
`docs/VPS_DEPLOY.md`, `docs/ENVIRONMENT.md`, `docs/exit-lovable-plan.md`,
`.env.example`. Remove env-var references to `GIGI_TOKEN_KEY`,
`CHATGPT_OAUTH_REDIRECT_URI`, `CHATGPT_OAUTH_CLIENT_ID`.

## Files added

### `src/lib/secrets-store.server.ts` (server-only)

Generic AES-256-GCM helpers extracted from `oauth-chatgpt.server.ts`. Same
crypto, same `iv:tag:ciphertext` base64url format, but no ChatGPT-shaped
struct — caller passes an arbitrary `Record<string, unknown>` payload that
gets JSON-stringified.

```
encryptSecret(payload: Record<string, unknown>): string
decryptSecret(blob: string): Record<string, unknown>
```

Loads the key from `process.env.AGATA_SECRETS_KEY`. Throws a clear error
when the env var is missing or not exactly 32 bytes after base64 decode —
same shape as the existing `GIGI_TOKEN_KEY` errors so operators see a
hint, not a stack trace.

### `src/lib/openai-key-store.server.ts` (server-only)

Two `settings` rows: `agata.openai.apiKey` (encrypted) and
`agata.openai.model` (plaintext). Surface:

```
type StoredOpenAIKey = { apiKey: string; model: string };
getStoredOpenAIKey(): Promise<StoredOpenAIKey | undefined>
saveOpenAIKey(input: { apiKey: string; model: string }): Promise<void>
clearOpenAIKey(): Promise<void>
```

`saveOpenAIKey` re-validates via the shared Zod schema
(`OpenAIKeyInputSchema`) so a route that forgets to validate can't poison
the store. `getStoredOpenAIKey` returns `undefined` on missing rows or on
crypto failure (key rotated); throws on the env-missing case so the
operator sees the hint.

### `src/routes/api/openai-key/{status,save,delete}.ts`

Three small endpoints. JSON in/out, same shape as the deleted
`/api/chatgpt/*` endpoints but without cookies, PKCE, or redirects.

- `GET /api/openai-key/status` →
  `{ configured: boolean, source: "env" | "stored" | "none", model?: string, masked?: string }`.
  `source: "env"` is reported when `OPENAI_API_KEY` is set in `process.env`
  even if a stored key also exists — env wins, and the UI must show a
  different state. `masked` is the first 7 chars + ellipsis + last 4 chars
  of the key (e.g. `sk` + dash + prefix + … + suffix) — only present when
  `source === "stored"`.
- `POST /api/openai-key/save` — body `{ apiKey: string, model: string }`
  parsed via `OpenAIKeyInputSchema`. Returns
  `{ ok: true, model, masked }`. On validation failure: `400 { error, details }`.
  On missing `AGATA_SECRETS_KEY`: `500 { error: "missing-encryption-key" }`
  so the operator notice is actionable.
- `POST /api/openai-key/delete` — clears both rows. Always `200 { ok: true }`
  even when nothing was stored.

### `src/lib/api/openai-key.functions.ts`

TanStack `createServerFn` RPCs. Mirrors the existing `*.functions.ts`
pattern: `getOpenAIKeyStatus`, `saveOpenAIKey`, `deleteOpenAIKey`. These
are the client-callable wrappers; the routes above are not imported from
React components directly.

### `src/lib/api/schemas.ts` — additive

```
export const OPENAI_KEY_MODELS = [
  "gpt-5.4-mini",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini",
] as const;

export const OpenAIKeyInputSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "Klucz OpenAI jest za krótki")
    .max(256, "Klucz OpenAI jest za długi")
    .regex(
      /^sk-(proj-)?[A-Za-z0-9_-]+$/,
      "Nieprawidłowy format klucza OpenAI (powinien zaczynać się od sk- lub sk-proj-)",
    ),
  model: z.enum(OPENAI_KEY_MODELS),
});
```

The enum is the single source of truth for the dropdown options — both
the route and the React component import it so the UI cannot drift from
the validator.

### `src/components/OpenAIKeyCard.tsx`

Settings → Prywatność i dostęp Gigi. Three render branches driven by
`source`:

- `"none"` — password input "Klucz API OpenAI" + `<select>` of the model
  enum + "Zapisz klucz" button + small helper text: "Klucz jest szyfrowany
  i przechowywany lokalnie. Używany tylko do rozmów z Gigi."
- `"stored"` — green panel "Zapisano klucz OpenAI · model `gpt-5.4-mini` ·
  `sk-…abcd`" + "Usuń klucz" destructive button.
- `"env"` — amber panel "Klucz API OpenAI jest ustawiony w zmiennych
  środowiskowych serwera. Możesz go nadpisać, wklejając własny poniżej."
  - a collapsible form (same as the `"none"` branch).

Pure helpers live in `OpenAIKeyCard.helpers.ts`:

```
maskOpenAIKey(raw: string): string
//   "sk-..." (first 7 + "…" + last 4). Returns "" for falsy input.
//   Used so the saved-state panel can show the user which key is in
//   use without ever exposing the secret.

isValidOpenAIKeyShape(raw: string): boolean
//   matches the same regex as the Zod schema (used for client-side
//   disabled state on the Save button before the round-trip).
```

The card uses `useOpenAIKeyStatusQuery()` for the initial paint and
`useSaveOpenAIKeyMutation()` / `useDeleteOpenAIKeyMutation()` for the
mutations. `toast.success` / `toast.error` on outcome. `invalidateQueries`
on success so the banner on `/gigi` updates without a hard refresh.

### `src/lib/api/client.ts` — additive

```
export const qk = { ... openaiKeyStatus: ["openai-key", "status"] as const };

export interface OpenAIKeyStatus {
  configured: boolean;
  source: "env" | "stored" | "none";
  model?: string;
  masked?: string;
}

export function useOpenAIKeyStatusQuery() { ... } // staleTime 10s, retry 1
export function invalidateOpenAIKeyStatus(qc): void;
export function useSaveOpenAIKeyMutation() { ... }
export function useDeleteOpenAIKeyMutation() { ... }
```

## Files modified

- `src/lib/gigi/resolver.ts` — drop `chatgpt`, update `OPENAI_MODEL`
  default to `gpt-5.4-mini`, rewrite `notConfiguredMessage` to mention
  "Ustaw klucz OpenAI w Ustawieniach lub OPENAI_API_KEY w /etc/agata.env."
- `src/lib/gigi/build-model.ts` — remove `tryBuildChatGPTFromStore`,
  remove `buildChatGPTModel` import, add `tryBuildOpenAIFromStore` that
  reads from `getStoredOpenAIKey()` when env provider returns null and a
  stored key exists. The auto-pick rule is symmetric to today's
  chatgpt-auto-pick: env wins → none wins → stored → null.
- `src/lib/gigi/providers/openai.ts` — change `DEFAULT_MODEL` from
  `gpt-4o-mini` to `gpt-5.4-mini`.
- `src/routes/api/chat.ts` — no behavioural change. Still calls
  `buildGigiModel()`. The 503 path now surfaces the rewritten
  `notConfiguredMessage`.
- `src/routes/gigi.tsx` — remove the OAuth-first landing. Replace
  `viewState === "needs-oauth"` branch with a `<GigiNoKeyBanner />`
  rendered conditionally above the chat. The composer / prompts / welcome
  message are always shown (matches the requested "ai powinno dzialac
  normalnie" UX).
- `src/routes/settings.tsx` — swap `<ChatGPTConnectCard />` for
  `<OpenAIKeyCard />` inside the existing section. Nothing else in the
  privacy section changes.

## Env vars

- **Removed:** `GIGI_TOKEN_KEY`, `CHATGPT_OAUTH_REDIRECT_URI`,
  `CHATGPT_OAUTH_CLIENT_ID`.
- **Added:** `AGATA_SECRETS_KEY` (32B base64). Required for the UI key
  storage to work. Same `openssl rand -base64 32 | sudo tee -a
/etc/agata.env` bootstrap as today. If unset, `encryptSecret` throws
  with a clear hint, the save endpoint returns `500 missing-encryption-key`,
  and the operator sees the message in the UI toast.
- **Unchanged:** `OPENAI_API_KEY` (still primary), `OPENAI_MODEL`
  (override env, default now `gpt-5.4-mini`), `GIGI_SECRET`,
  `LOVABLE_API_KEY`, `AZURE_OPENAI_*`, `OLLAMA_*`, `GIGI_MOCK`,
  `GIGI_PROVIDER`.

## Tests

- `secrets-store.spec.ts` (new) — encrypt/decrypt round-trip, tampered
  ciphertext throws, missing env throws with the hint, wrong key length
  throws.
- `openai-key-store.spec.ts` (new) — save/get/clear, round-trip after
  encryption, get on empty store returns undefined, get on missing
  `AGATA_SECRETS_KEY` throws.
- `openai-key.functions.spec.ts` (new) — `OpenAIKeyInputSchema` rejects
  short / long / malformed input, accepts canonical `sk-…` and
  `sk-proj-…` strings.
- `OpenAIKeyCard.helpers.spec.ts` (new) — `maskOpenAIKey` produces the
  documented shape; `isValidOpenAIKeyShape` matches the schema regex.
- `resolver.spec.ts` — remove the four `chatgpt`-related cases; add
  "default model is `gpt-5.4-mini`".
- `build-model.spec.ts` — replace `chatgpt` cases with two new cases:
  (1) env unset + no stored key → `null`; (2) env unset + stored key →
  `openai` provider with the model from the store.
- `providers/openai.spec.ts` — update the default-model test.
- `gigi.spec.ts` — remove the OAuth-first assertions; add a single case
  that renders the banner when status is `{ configured: false }` and
  does NOT render it when `{ configured: true }`.
- `gigi-view-state.spec.ts` — delete the file (state machine is gone).

## Risks

- **Import-time cost of `AGATA_SECRETS_KEY`**: the secret-store throws
  at first call, not at import. That keeps the module loadable in test
  contexts where the env isn't set. Verified by mirroring today's
  `oauth-chatgpt.server.ts` behaviour.
- **Backup importer overwriting the key**: `applyImport` (Phase 1.5) does
  not touch `settings` rows, only books/notes/sessions/goals. Verified
  in `import-schema.ts` — the import payload has no settings field.
  Documented in the backup UI.
- **VPS deploy ops**: existing deploys have `GIGI_TOKEN_KEY` in
  `/etc/agata.env`. After this change that var is unused. Operators
  should rename it to `AGATA_SECRETS_KEY` in the same deploy. Document
  in `deploy/README.md` ops checklist.
- **`gpt-5.4-mini` not yet released**: the user asked for this exact
  string. If OpenAI rejects the model id at request time, the chat will
  surface the provider error verbatim (today's 4xx/5xx handling already
  shows the message). Operators can change via `OPENAI_MODEL` env or
  via the dropdown in Settings — both are first-class.

## Out of scope

- Multi-key / per-user key management (single-user app).
- Key rotation UI (regenerate the encrypted blob with a new key).
- Audit log of key usage (would require logging at the chat route).
- Moving the model enum to a server-fetched list (OpenAI `/v1/models`).
  Hardcoded enum is fine for now.
