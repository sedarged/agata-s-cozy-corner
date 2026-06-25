# OpenAI API Key (replacing ChatGPT OAuth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire ChatGPT OAuth (Codex) flow with a Settings UI for pasting an OpenAI API key. Gigi continues to work exactly as today (streaming chat with library context, Polish system prompt, AbortController on unmount); only the auth/key source changes.

**Architecture:** Two-row `settings` store (`agata.openai.apiKey` encrypted with AES-256-GCM via a generic `secrets-store`, `agata.openai.model` plaintext). Precedence: `OPENAI_API_KEY` env wins → stored UI key → 503. New `<OpenAIKeyCard />` in Settings → Prywatność i dostęp Gigi with three branches (`none` / `stored` / `env`). `/gigi` shows a small banner instead of an OAuth gate. Default model `gpt-5.4-mini`.

**Tech Stack:** TanStack Start, React 19, Zod, better-sqlite3, AES-256-GCM (`node:crypto`), AI SDK v3, Vitest-style `node:test` + `tsx`.

## Global Constraints

- AES-256-GCM, 12-byte IV, 16-byte tag, base64url no-padding, format `iv:tag:ct`. Reuse the proven crypto from `src/lib/gigi/oauth-chatgpt.server.ts`.
- Encryption env var: `AGATA_SECRETS_KEY` (32 random bytes base64). Renamed from `GIGI_TOKEN_KEY` (which is removed).
- Test framework: `node:test` + `assert/strict` + `tsx`. Run via `npm test`. Spec files live next to source (`foo.ts` → `foo.spec.ts`).
- Every Zod input is bounded per project rule "per-field Zod caps": `apiKey` 20–256 chars, `model` is a closed enum.
- Polish UI strings, English code. Match existing file style.
- TDD: write the spec first, run it (fail), implement, run it (pass), commit.
- Conventional Commits (`feat:` / `fix:` / `chore:` / `docs:` / `test:`). Keep the historical `chatgpt-oauth:` prefix out — we're removing it.
- **Test fixtures use underscored placeholders**, e.g. `sk-aaaa_bbbb_cccc_dddd_eeee`. The schema regex accepts underscores; secret-scanners do not flag them. Never hard-code a real-looking OpenAI key in any test.

---

## File Structure

### Created

| Path                                           | Responsibility                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/lib/secrets-store.server.ts`              | Generic AES-256-GCM encrypt/decrypt using `AGATA_SECRETS_KEY`.                            |
| `src/lib/secrets-store.spec.ts`                | Round-trip + error-path tests.                                                            |
| `src/lib/openai-key-store.server.ts`           | Settings-backed CRUD for the stored OpenAI key.                                           |
| `src/lib/openai-key-store.spec.ts`             | Save/get/clear tests against an in-memory `getSetting/setSetting` mock.                   |
| `src/lib/api/openai-key.functions.ts`          | TanStack `createServerFn` RPCs: `getOpenAIKeyStatus`, `saveOpenAIKey`, `deleteOpenAIKey`. |
| `src/lib/api/openai-key.functions.spec.ts`     | Schema-validation tests.                                                                  |
| `src/routes/api/openai-key/status.ts`          | `GET` — returns `{ configured, source, model?, masked? }`.                                |
| `src/routes/api/openai-key/save.ts`            | `POST` — validates and persists.                                                          |
| `src/routes/api/openai-key/delete.ts`          | `POST` — clears both rows.                                                                |
| `src/components/OpenAIKeyCard.tsx`             | Settings UI card, three branches (`none`/`stored`/`env`).                                 |
| `src/components/OpenAIKeyCard.helpers.ts`      | Pure helpers: `maskOpenAIKey`, `isValidOpenAIKeyShape`.                                   |
| `src/components/OpenAIKeyCard.helpers.spec.ts` | Helper tests.                                                                             |

### Modified

| Path                                    | Change                                                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/schemas.ts`                | Add `OPENAI_KEY_MODELS` const + `OpenAIKeyInputSchema`.                                                                                                                                                                                      |
| `src/lib/api/client.ts`                 | Drop `qk.chatgptStatus` + `useChatgptStatusQuery` + `invalidateChatgptStatus` + `ChatgptStatus`. Add `qk.openaiKeyStatus`, `useOpenAIKeyStatusQuery`, `invalidateOpenAIKeyStatus`, `useSaveOpenAIKeyMutation`, `useDeleteOpenAIKeyMutation`. |
| `src/lib/gigi/resolver.ts`              | Remove `"chatgpt"` provider; default `OPENAI_MODEL` → `gpt-5.4-mini`; rewrite `notConfiguredMessage`.                                                                                                                                        |
| `src/lib/gigi/build-model.ts`           | Remove `tryBuildChatGPTFromStore`; add `tryBuildOpenAIFromStore` that reads `getStoredOpenAIKey()`.                                                                                                                                          |
| `src/lib/gigi/providers/openai.ts`      | `DEFAULT_MODEL` → `gpt-5.4-mini`.                                                                                                                                                                                                            |
| `src/routes/gigi.tsx`                   | Drop OAuth-first landing; add `<GigiNoKeyBanner />` when `!configured`.                                                                                                                                                                      |
| `src/routes/settings.tsx`               | Replace `<ChatGPTConnectCard />` with `<OpenAIKeyCard />`.                                                                                                                                                                                   |
| `CLAUDE.md`                             | Replace "Faza 2 — OAuth" section; update env-var list.                                                                                                                                                                                       |
| `deploy/README.md`                      | Replace OAuth ops checklist with API-key ops checklist.                                                                                                                                                                                      |
| `docs/VPS_DEPLOY.md`                    | Replace `OPENAI_API_KEY` mention + remove `GIGI_TOKEN_KEY`/`CHATGPT_OAUTH_*` lines.                                                                                                                                                          |
| `docs/ENVIRONMENT.md`                   | Drop OAuth env vars; add `AGATA_SECRETS_KEY`.                                                                                                                                                                                                |
| `docs/exit-lovable-plan.md`             | Remove Codex section.                                                                                                                                                                                                                        |
| `.env.example`                          | Remove `GIGI_TOKEN_KEY`, `CHATGPT_OAUTH_*`; add `AGATA_SECRETS_KEY`.                                                                                                                                                                         |
| `src/lib/gigi/resolver.spec.ts`         | Remove chatgpt cases; assert default model.                                                                                                                                                                                                  |
| `src/lib/gigi/build-model.spec.ts`      | Replace chatgpt cases with stored-key cases.                                                                                                                                                                                                 |
| `src/lib/gigi/providers/openai.spec.ts` | Update default-model assertion.                                                                                                                                                                                                              |
| `src/routes/gigi.spec.ts`               | Remove OAuth-first assertions; add banner-present / banner-absent assertions.                                                                                                                                                                |

### Removed

- `src/lib/gigi/oauth-chatgpt.ts`
- `src/lib/gigi/oauth-chatgpt.flow.ts`
- `src/lib/gigi/oauth-chatgpt.server.ts`
- `src/lib/gigi/oauth-redirect-uri.ts`
- `src/lib/gigi/oauth-redirect-uri-client.ts`
- `src/lib/gigi/oauth-chatgpt.spec.ts`
- `src/lib/gigi/oauth-chatgpt.flow.spec.ts`
- `src/lib/gigi/oauth-chatgpt.server.spec.ts`
- `src/lib/gigi/oauth-chatgpt-refresh.spec.ts`
- `src/lib/gigi/oauth-redirect-uri.spec.ts`
- `src/lib/gigi/oauth-redirect-uri-client.spec.ts`
- `src/lib/gigi/providers/chatgpt.ts`
- `src/lib/gigi/providers/chatgpt.spec.ts`
- `src/routes/api/chatgpt/login.ts` (+ `.spec.ts`)
- `src/routes/api/chatgpt/callback.ts`
- `src/routes/api/chatgpt/exchange.ts`
- `src/routes/api/chatgpt/disconnect.ts`
- `src/routes/api/chatgpt/status.ts`
- `src/routes/api/chatgpt/redirect-uri.ts`
- `src/components/ChatGPTConnectCard.tsx`
- `src/components/chatgpt-connect-card.helpers.ts` (+ `.spec.ts`)
- `src/routes/gigi-view-state.ts` (+ `.spec.ts`)

---

## Task 1: Generic `secrets-store.server.ts` (TDD)

**Files:**

- Create: `src/lib/secrets-store.server.ts`
- Create: `src/lib/secrets-store.spec.ts`

**Interfaces:**

- Consumes: nothing (standalone)
- Produces:
  - `encryptSecret(payload: Record<string, unknown>): string` — returns `iv:tag:ct` base64url no-padding
  - `decryptSecret(blob: string): Record<string, unknown>` — returns parsed JSON, throws on tamper
  - Reads `process.env.AGATA_SECRETS_KEY` (32-byte base64)

- [ ] **Step 1: Write failing test**

`src/lib/secrets-store.spec.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Force the env var before importing the module under test.
const KEY = randomBytes(32).toString("base64");
process.env.AGATA_SECRETS_KEY = KEY;

const { encryptSecret, decryptSecret } = await import("./secrets-store.server");

test("round-trips an arbitrary payload", () => {
  const blob = encryptSecret({ hello: "world", n: 42 });
  assert.equal(typeof blob, "string");
  const parts = blob.split(":");
  assert.equal(parts.length, 3);
  assert.deepEqual(decryptSecret(blob), { hello: "world", n: 42 });
});

test("two encryptions of the same payload produce different ciphertexts (random IV)", () => {
  const a = encryptSecret({ x: 1 });
  const b = encryptSecret({ x: 1 });
  assert.notEqual(a, b);
});

test("tampered ciphertext throws", () => {
  const blob = encryptSecret({ ok: true });
  // flip a character in the last segment
  const tampered = blob.slice(0, -1) + (blob.endsWith("a") ? "b" : "a");
  assert.throws(() => decryptSecret(tampered));
});

test("malformed blob throws", () => {
  assert.throws(() => decryptSecret("not-a-blob"), /invalid encrypted secret format/);
});

test("missing AGATA_SECRETS_KEY throws with a hint", async () => {
  const saved = process.env.AGATA_SECRETS_KEY;
  delete process.env.AGATA_SECRETS_KEY;
  // re-import to pick up the env-less state via the cache-busting trick
  const mod = await import(`./secrets-store.server?missing=${Date.now()}`);
  try {
    assert.throws(() => mod.encryptSecret({ x: 1 }), /AGATA_SECRETS_KEY/);
  } finally {
    process.env.AGATA_SECRETS_KEY = saved;
  }
});

test("wrong-length key throws with a hint", () => {
  const saved = process.env.AGATA_SECRETS_KEY!;
  process.env.AGATA_SECRETS_KEY = "tooshort";
  try {
    assert.throws(() => encryptSecret({ x: 1 }), /AGATA_SECRETS_KEY/);
  } finally {
    process.env.AGATA_SECRETS_KEY = saved;
  }
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/lib/secrets-store.spec.ts
```

Expected: FAIL — module `./secrets-store.server` not found.

- [ ] **Step 3: Implement minimal `secrets-store.server.ts`**

```ts
// Agata — generic AES-256-GCM encrypt/decrypt for small JSON blobs stored
// in the `settings` table. The encryption key lives in
// `process.env.AGATA_SECRETS_KEY` (32 random bytes, base64).
//
// Output format: `iv:tag:ciphertext`, each segment base64url with no
// padding. 12-byte IV (GCM standard), 16-byte auth tag.
//
// Replaces the previous GIGI_TOKEN_KEY-backed chatgpt-oauth token store
// (see oauth-chatgpt.server.ts, removed in the api-key redesign).
import "@tanstack/react-start/server-only";
import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from "node:crypto";

const ALGO: CipherGCMTypes = "aes-256-gcm";

function loadKey(): Buffer {
  const k = process.env.AGATA_SECRETS_KEY;
  if (!k) {
    throw new Error(
      "AGATA_SECRETS_KEY is not set. Generate 32 random bytes (base64) and add to /etc/agata.env.",
    );
  }
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `AGATA_SECRETS_KEY must decode to exactly 32 bytes (got ${buf.length}). Regenerate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

export function encryptSecret(payload: Record<string, unknown>): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(blob: string): Record<string, unknown> {
  const parts = blob.split(":");
  if (parts.length !== 3) throw new Error("invalid encrypted secret format");
  const [ivPart, tagPart, ctPart] = parts;
  const key = loadKey();
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ct = Buffer.from(ctPart, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as Record<string, unknown>;
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/lib/secrets-store.spec.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/secrets-store.server.ts src/lib/secrets-store.spec.ts
git commit -m "feat(secrets-store): generic AES-256-GCM helper backed by AGATA_SECRETS_KEY"
```

---

## Task 2: `openai-key-store.server.ts` (TDD)

**Files:**

- Create: `src/lib/openai-key-store.server.ts`
- Create: `src/lib/openai-key-store.spec.ts`

**Interfaces:**

- Consumes:
  - `encryptSecret`, `decryptSecret` from `./secrets-store.server`
  - `getSetting`, `setSetting`, `deleteSetting` from `@/lib/db/repositories/goals`
  - `OpenAIKeyInputSchema` from `@/lib/api/schemas` (Task 3)
- Produces:
  - `StoredOpenAIKey = { apiKey: string; model: string }`
  - `getStoredOpenAIKey(): Promise<StoredOpenAIKey | undefined>`
  - `saveOpenAIKey(input: { apiKey: string; model: string }): Promise<void>`
  - `clearOpenAIKey(): Promise<void>`

- [ ] **Step 1: Write failing test**

`src/lib/openai-key-store.spec.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.AGATA_SECRETS_KEY = randomBytes(32).toString("base64");

// Stub the settings repo before importing the module under test.
const store = new Map<string, unknown>();
import * as repo from "@/lib/db/repositories/goals";
(repo as any).getSetting = async (key: string) => store.get(key);
(repo as any).setSetting = async (key: string, value: unknown) => {
  store.set(key, value);
};
(repo as any).deleteSetting = async (key: string) => {
  store.delete(key);
};

const { getStoredOpenAIKey, saveOpenAIKey, clearOpenAIKey } =
  await import("./openai-key-store.server");
// 24-char placeholder; underscores keep the secret-scanner quiet.
const KEY = "sk-aaaa_bbbb_cccc_dddd_eeee";

test("save + get round-trips through encryption", async () => {
  await saveOpenAIKey({ apiKey: KEY, model: "gpt-5.4-mini" });
  const got = await getStoredOpenAIKey();
  assert.deepEqual(got, { apiKey: KEY, model: "gpt-5.4-mini" });

  // The stored blob must NOT contain the plaintext key.
  const stored = store.get("agata.openai.apiKey") as string;
  assert.equal(typeof stored, "string");
  assert.ok(!stored.includes(KEY), "stored blob should not contain plaintext key");
});

test("get on empty store returns undefined", async () => {
  store.clear();
  const got = await getStoredOpenAIKey();
  assert.equal(got, undefined);
});

test("clear removes both rows", async () => {
  await saveOpenAIKey({ apiKey: KEY, model: "gpt-5" });
  await clearOpenAIKey();
  assert.equal(store.has("agata.openai.apiKey"), false);
  assert.equal(store.has("agata.openai.model"), false);
});

test("save re-validates input (rejects too-short key)", async () => {
  await assert.rejects(
    () => saveOpenAIKey({ apiKey: "short", model: "gpt-5.4-mini" }),
    /Klucz OpenAI jest za krótki/,
  );
});

test("get returns undefined when ciphertext is corrupt", async () => {
  store.set("agata.openai.apiKey", "not-a-blob");
  const got = await getStoredOpenAIKey();
  assert.equal(got, undefined);
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/lib/openai-key-store.spec.ts
```

Expected: FAIL — module `./openai-key-store.server` not found.

- [ ] **Step 3: Implement `openai-key-store.server.ts`**

```ts
// Agata — server-only OpenAI API key store. Two rows in the `settings`
// table: `agata.openai.apiKey` (encrypted via secrets-store) and
// `agata.openai.model` (plaintext). The model picker persists alongside
// the key so the user doesn't have to re-select after a key rotation.
import "@tanstack/react-start/server-only";

import { getSetting, setSetting, deleteSetting } from "@/lib/db/repositories/goals";
import { encryptSecret, decryptSecret } from "@/lib/secrets-store.server";
import { OpenAIKeyInputSchema } from "@/lib/api/schemas";

const KEY_KEY = "agata.openai.apiKey";
const MODEL_KEY = "agata.openai.model";

export interface StoredOpenAIKey {
  apiKey: string;
  model: string;
}

export async function saveOpenAIKey(input: { apiKey: string; model: string }): Promise<void> {
  // Re-validate at the storage boundary — a route that forgot to
  // validate can't poison the store.
  const parsed = OpenAIKeyInputSchema.parse(input);
  const blob = encryptSecret({ apiKey: parsed.apiKey });
  await setSetting(KEY_KEY, blob);
  await setSetting(MODEL_KEY, parsed.model);
}

export async function getStoredOpenAIKey(): Promise<StoredOpenAIKey | undefined> {
  const blob = await getSetting<string>(KEY_KEY);
  const model = await getSetting<string>(MODEL_KEY);
  if (!blob || !model) return undefined;
  try {
    const payload = decryptSecret(blob);
    if (typeof payload.apiKey !== "string") return undefined;
    return { apiKey: payload.apiKey, model };
  } catch (err) {
    // Distinguish "operator forgot /etc/agata.env AGATA_SECRETS_KEY"
    // (fixable server-side — surface it loudly) from "blob is corrupt
    // or key was rotated" (the user has to re-enter — silent fallback).
    if (err instanceof Error && err.message.startsWith("AGATA_SECRETS_KEY")) throw err;
    return undefined;
  }
}

export async function clearOpenAIKey(): Promise<void> {
  await deleteSetting(KEY_KEY);
  await deleteSetting(MODEL_KEY);
}
```

> This step references `OpenAIKeyInputSchema` from Task 3. Execute Task 3 first if the import errors at runtime.

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/lib/openai-key-store.spec.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai-key-store.server.ts src/lib/openai-key-store.spec.ts
git commit -m "feat(openai-key-store): encrypted settings-backed key store"
```

---

## Task 3: Zod schema `OpenAIKeyInputSchema` (TDD)

**Files:**

- Modify: `src/lib/api/schemas.ts` (append)
- Create: `src/lib/api/openai-key.functions.spec.ts` (schema validation lives here)

**Interfaces:**

- Produces:
  - `OPENAI_KEY_MODELS = ["gpt-5.4-mini", "gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"] as const`
  - `OpenAIKeyInputSchema = z.object({ apiKey: string 20..256 + regex, model: enum })`

- [ ] **Step 1: Write failing test**

`src/lib/api/openai-key.functions.spec.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIKeyInputSchema } from "./schemas";

// 24-char placeholder; underscores keep the secret-scanner quiet.
const VALID = "sk-aaaa_bbbb_cccc_dddd_eeee";
const VALID_PROJ = "sk-proj-aaaa_bbbb_cccc_dddd";

test("accepts canonical sk- key with valid model", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: VALID, model: "gpt-5.4-mini" });
  assert.equal(r.success, true);
});

test("accepts sk-proj- key with valid model", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: VALID_PROJ, model: "gpt-5" });
  assert.equal(r.success, true);
});

test("rejects too-short key", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: "sk-short", model: "gpt-5.4-mini" });
  assert.equal(r.success, false);
  if (!r.success) assert.match(r.error.issues[0].message, /za krótki/);
});

test("rejects too-long key", () => {
  const long = "sk-" + "a".repeat(260);
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: long, model: "gpt-5.4-mini" });
  assert.equal(r.success, false);
});

test("rejects malformed key (no prefix)", () => {
  const r = OpenAIKeyInputSchema.safeParse({
    apiKey: "aaaa_bbbb_cccc_dddd_eeee",
    model: "gpt-5.4-mini",
  });
  assert.equal(r.success, false);
});

test("rejects unknown model", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: VALID, model: "gpt-99" });
  assert.equal(r.success, false);
});

test("trims whitespace around the key", () => {
  const r = OpenAIKeyInputSchema.safeParse({ apiKey: "  " + VALID + "  ", model: "gpt-5.4-mini" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.apiKey, VALID);
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/lib/api/openai-key.functions.spec.ts
```

Expected: FAIL — `OpenAIKeyInputSchema` is not exported.

- [ ] **Step 3: Add to `src/lib/api/schemas.ts`**

Open `src/lib/api/schemas.ts` and append at the end:

```ts
// ---- OpenAI API key (Settings → Prywatność i dostęp Gigi) ----

export const OPENAI_KEY_MODELS = [
  "gpt-5.4-mini",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini",
] as const;

export type OpenAIKeyModel = (typeof OPENAI_KEY_MODELS)[number];

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

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/lib/api/openai-key.functions.spec.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/schemas.ts src/lib/api/openai-key.functions.spec.ts
git commit -m "feat(schemas): add OPENAI_KEY_MODELS enum + OpenAIKeyInputSchema"
```

---

## Task 4: API routes — `status`, `save`, `delete`

**Files:**

- Create: `src/routes/api/openai-key/status.ts`
- Create: `src/routes/api/openai-key/save.ts`
- Create: `src/routes/api/openai-key/delete.ts`

**Interfaces:**

- Consumes:
  - `OpenAIKeyInputSchema` from `@/lib/api/schemas`
  - `getStoredOpenAIKey`, `saveOpenAIKey`, `clearOpenAIKey` from `@/lib/openai-key-store.server`
  - `maskOpenAIKey` from `@/components/OpenAIKeyCard.helpers` (Task 6)
- Produces:
  - `GET /api/openai-key/status` → `{ configured, source, model?, masked? }`
  - `POST /api/openai-key/save` → `{ ok, model, masked }` or `400 / 500`
  - `POST /api/openai-key/delete` → `{ ok: true }`

- [ ] **Step 1: Implement `status.ts`**

```ts
// Agata — `GET /api/openai-key/status`
//
// Reports which OpenAI API key source is currently in effect so the
// Settings card can render the right branch (none / stored / env).
// Precedence: OPENAI_API_KEY env wins over the stored UI key.
import { createFileRoute } from "@tanstack/react-router";

import { getStoredOpenAIKey } from "@/lib/openai-key-store.server";
import { maskOpenAIKey } from "@/components/OpenAIKeyCard.helpers";

export const Route = createFileRoute("/api/openai-key/status")({
  server: {
    handlers: {
      GET: async () => {
        const envKey = process.env.OPENAI_API_KEY?.trim();
        if (envKey) {
          return Response.json({
            configured: true,
            source: "env" as const,
          });
        }
        const stored = await getStoredOpenAIKey();
        if (stored) {
          return Response.json({
            configured: true,
            source: "stored" as const,
            model: stored.model,
            masked: maskOpenAIKey(stored.apiKey),
          });
        }
        return Response.json({ configured: false, source: "none" as const });
      },
    },
  },
});
```

- [ ] **Step 2: Implement `save.ts`**

```ts
// Agata — `POST /api/openai-key/save`
//
// Validates the body with OpenAIKeyInputSchema and persists the key
// (encrypted) + model (plaintext) to the settings store. Returns the
// masked key so the UI can update its state without a refetch.
import { createFileRoute } from "@tanstack/react-router";

import { OpenAIKeyInputSchema } from "@/lib/api/schemas";
import { saveOpenAIKey } from "@/lib/openai-key-store.server";
import { maskOpenAIKey } from "@/components/OpenAIKeyCard.helpers";

export const Route = createFileRoute("/api/openai-key/save")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = OpenAIKeyInputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid body", details: parsed.error.issues },
            { status: 400 },
          );
        }
        try {
          await saveOpenAIKey(parsed.data);
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("AGATA_SECRETS_KEY")) {
            return Response.json({ error: "missing-encryption-key" }, { status: 500 });
          }
          throw err;
        }
        return Response.json({
          ok: true,
          model: parsed.data.model,
          masked: maskOpenAIKey(parsed.data.apiKey),
        });
      },
    },
  },
});
```

- [ ] **Step 3: Implement `delete.ts`**

```ts
// Agata — `POST /api/openai-key/delete`
//
// Removes the stored OpenAI key from the settings table. Idempotent —
// always returns `{ ok: true }` even when nothing was stored.
import { createFileRoute } from "@tanstack/react-router";

import { clearOpenAIKey } from "@/lib/openai-key-store.server";

export const Route = createFileRoute("/api/openai-key/delete")({
  server: {
    handlers: {
      POST: async () => {
        await clearOpenAIKey();
        return Response.json({ ok: true });
      },
    },
  },
});
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: errors only for missing `maskOpenAIKey` (Task 6) — fix in Task 6 then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/openai-key/
git commit -m "feat(api/openai-key): status, save, delete endpoints"
```

---

## Task 5: RPC functions + React Query hooks

**Files:**

- Create: `src/lib/api/openai-key.functions.ts`
- Modify: `src/lib/api/client.ts` (drop chatgpt, add openai-key)

**Interfaces:**

- Produces:
  - `getOpenAIKeyStatus()`, `saveOpenAIKey({ apiKey, model })`, `deleteOpenAIKey()` — TanStack RPCs
  - `qk.openaiKeyStatus`
  - `OpenAIKeyStatus` interface
  - `useOpenAIKeyStatusQuery()`, `invalidateOpenAIKeyStatus(qc)`
  - `useSaveOpenAIKeyMutation()`, `useDeleteOpenAIKeyMutation()`

- [ ] **Step 1: Implement `src/lib/api/openai-key.functions.ts`**

Inspect `src/lib/api/goals.functions.ts` (or any sibling `*.functions.ts`) to see the project's TanStack Start RPC pattern. Mirror its `createServerFn` shape exactly. A typical signature is:

```ts
import { createServerFn } from "@tanstack/react-start";
import { OpenAIKeyInputSchema } from "./schemas";

export const getOpenAIKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  // delegate to the route — see how goals.functions.ts does this for getGoals
  const { getOpenAIKeyStatus: routeHandler } = await import("@/routes/api/openai-key/status");
  // ... call routeHandler handler manually OR call fetch as below
  const res = await fetch(/* same as a route */);
  return await res.json();
});
```

The exact pattern depends on the project. If unsure, use a thin `fetch` wrapper (works against the same Nitro server in dev and prod):

```ts
async function rpc<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

export const getOpenAIKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  return rpc<{
    configured: boolean;
    source: "env" | "stored" | "none";
    model?: string;
    masked?: string;
  }>("/api/openai-key/status");
});

export const saveOpenAIKey = createServerFn({ method: "POST" })
  .validator((input: unknown) => OpenAIKeyInputSchema.parse(input))
  .handler(async ({ data }) => {
    return rpc<{ ok: true; model: string; masked: string }>("/api/openai-key/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  });

export const deleteOpenAIKey = createServerFn({ method: "POST" }).handler(async () => {
  return rpc<{ ok: true }>("/api/openai-key/delete", { method: "POST" });
});
```

> If the existing `*.functions.ts` files in this repo use a different pattern (e.g. direct DB access from the server function), follow that pattern instead — the routes above remain the client-facing surface.

- [ ] **Step 2: Modify `src/lib/api/client.ts`**

1. Add to `qk`:
   ```ts
   openaiKeyStatus: ["openai-key", "status"] as const,
   ```
2. Drop the entire `// ---------- chatgpt OAuth ----------` block (`ChatgptStatus` interface, `useChatgptStatusQuery`, `invalidateChatgptStatus`).
3. Remove `qk.chatgptStatus` from the existing `qk` object.
4. Append the openai-key hooks at the end (after the import block):

```ts
// ---------- openai api key ----------

export interface OpenAIKeyStatus {
  configured: boolean;
  source: "env" | "stored" | "none";
  model?: string;
  masked?: string;
}

export function useOpenAIKeyStatusQuery() {
  return useQuery<OpenAIKeyStatus>({
    queryKey: qk.openaiKeyStatus,
    queryFn: async () => {
      const res = await fetch("/api/openai-key/status", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`openai-key-status ${res.status}`);
      return (await res.json()) as OpenAIKeyStatus;
    },
    staleTime: 10_000,
    retry: 1,
  });
}

export function invalidateOpenAIKeyStatus(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: qk.openaiKeyStatus });
}

export function useSaveOpenAIKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { apiKey: string; model: string }) => saveOpenAIKey({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.openaiKeyStatus });
    },
  });
}

export function useDeleteOpenAIKeyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteOpenAIKey(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.openaiKeyStatus });
    },
  });
}
```

Also add the import at the top:

```ts
import * as openaiKeyApi from "@/lib/api/openai-key.functions";
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors (modulo any other in-flight tasks; fix only what this step introduces).

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/openai-key.functions.ts src/lib/api/client.ts
git commit -m "feat(api/client): drop chatgpt OAuth hooks, add openai-key React Query hooks"
```

---

## Task 6: `OpenAIKeyCard.helpers.ts` (TDD)

**Files:**

- Create: `src/components/OpenAIKeyCard.helpers.ts`
- Create: `src/components/OpenAIKeyCard.helpers.spec.ts`

**Interfaces:**

- Produces:
  - `maskOpenAIKey(raw: string): string` — returns `first7 + "…" + last4`, or `""` for empty
  - `isValidOpenAIKeyShape(raw: string): boolean` — matches the same regex as `OpenAIKeyInputSchema`

- [ ] **Step 1: Write failing test**

`src/components/OpenAIKeyCard.helpers.spec.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidOpenAIKeyShape, maskOpenAIKey } from "./OpenAIKeyCard.helpers";

// Placeholders with underscores so secret-scanners don't flag them.
const KEY_PLAIN = "sk-aaaa_bbbb_cccc_dddd_eeee";
const KEY_PROJ = "sk-proj-aaaa_bbbb_cccc_dddd_eeee";

test("maskOpenAIKey returns first 7 + … + last 4", () => {
  assert.equal(maskOpenAIKey(KEY_PLAIN), "sk-aaaa_…eeee");
});

test("maskOpenAIKey handles sk-proj- prefix", () => {
  assert.equal(maskOpenAIKey(KEY_PROJ), "sk-proj_…eeee");
});

test("maskOpenAIKey returns empty string for empty input", () => {
  assert.equal(maskOpenAIKey(""), "");
});

test("maskOpenAIKey returns empty string for very short input", () => {
  assert.equal(maskOpenAIKey("short"), "");
});

test("isValidOpenAIKeyShape accepts canonical keys", () => {
  assert.equal(isValidOpenAIKeyShape(KEY_PLAIN), true);
  assert.equal(isValidOpenAIKeyShape(KEY_PROJ), true);
});

test("isValidOpenAIKeyShape rejects malformed input", () => {
  assert.equal(isValidOpenAIKeyShape(""), false);
  assert.equal(isValidOpenAIKeyShape("aaaa_bbbb_cccc_dddd_eeee"), false);
  assert.equal(isValidOpenAIKeyShape("sk-short"), false);
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- src/components/OpenAIKeyCard.helpers.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

```ts
// Agata — pure helpers for `OpenAIKeyCard`.
//
// `maskOpenAIKey` is what we show in the UI when the key is already
// saved (the full key is never returned from the server). The format
// mirrors what users see in the OpenAI dashboard: a short prefix + … +
// last few chars.
//
// `isValidOpenAIKeyShape` is the client-side gate for the "Zapisz"
// button — it must stay in lockstep with `OpenAIKeyInputSchema` so the
// button doesn't enable an input the server will reject.

const OPENAI_KEY_REGEX = /^sk-(proj-)?[A-Za-z0-9_-]+$/;

export function maskOpenAIKey(raw: string): string {
  if (!raw || raw.length < 11) return "";
  return raw.slice(0, 7) + "…" + raw.slice(-4);
}

export function isValidOpenAIKeyShape(raw: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length < 20 || trimmed.length > 256) return false;
  return OPENAI_KEY_REGEX.test(trimmed);
}
```

- [ ] **Step 4: Run — verify it passes**

```bash
npm test -- src/components/OpenAIKeyCard.helpers.spec.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/OpenAIKeyCard.helpers.ts src/components/OpenAIKeyCard.helpers.spec.ts
git commit -m "feat(components): OpenAIKeyCard pure helpers (maskOpenAIKey, isValidOpenAIKeyShape)"
```

---

## Task 7: `OpenAIKeyCard.tsx`

**Files:**

- Create: `src/components/OpenAIKeyCard.tsx`

**Interfaces:**

- Consumes:
  - `useOpenAIKeyStatusQuery`, `useSaveOpenAIKeyMutation`, `useDeleteOpenAIKeyMutation` from `@/lib/api/client`
  - `OPENAI_KEY_MODELS`, `OpenAIKeyModel` from `@/lib/api/schemas`
  - `maskOpenAIKey`, `isValidOpenAIKeyShape` from `./OpenAIKeyCard.helpers`
  - `toast` from `sonner`, `Key` / `Trash2` / `CheckCircle2` / `AlertCircle` / `Eye` / `EyeOff` from `lucide-react`
- Produces: `<OpenAIKeyCard />` — three render branches (`none` / `stored` / `env`)

- [ ] **Step 1: Implement the component**

```tsx
// Agata — Settings → Prywatność i dostęp Gigi → OpenAI key card.
//
// Three branches driven by the /api/openai-key/status response:
//   "none"   — empty form (password input + model select + Zapisz)
//   "stored" — saved-key panel with masked key + Usuń
//   "env"    — amber banner (env var wins) + collapsible form
//
// The key is encrypted at rest via AGATA_SECRETS_KEY; the full key is
// never returned from the server after the initial save.
import { useEffect, useState } from "react";
import { Key, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import {
  useDeleteOpenAIKeyMutation,
  useOpenAIKeyStatusQuery,
  useSaveOpenAIKeyMutation,
} from "@/lib/api/client";
import { OPENAI_KEY_MODELS, type OpenAIKeyModel } from "@/lib/api/schemas";
import { isValidOpenAIKeyShape } from "./OpenAIKeyCard.helpers";

export function OpenAIKeyCard() {
  const statusQuery = useOpenAIKeyStatusQuery();
  const saveMutation = useSaveOpenAIKeyMutation();
  const deleteMutation = useDeleteOpenAIKeyMutation();

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<OpenAIKeyModel>("gpt-5.4-mini");
  const [reveal, setReveal] = useState(false);
  const [showEnvOverride, setShowEnvOverride] = useState(false);

  // When the status query resolves to "stored", lock the form to the
  // saved model so the dropdown starts on the same value.
  useEffect(() => {
    const s = statusQuery.data;
    if (
      s?.source === "stored" &&
      s.model &&
      (OPENAI_KEY_MODELS as readonly string[]).includes(s.model)
    ) {
      setModel(s.model as OpenAIKeyModel);
    }
  }, [statusQuery.data]);

  async function handleSave() {
    const trimmed = apiKey.trim();
    if (!isValidOpenAIKeyShape(trimmed)) {
      toast.error("Nieprawidłowy format klucza OpenAI (powinien zaczynać się od sk- lub sk-proj-)");
      return;
    }
    try {
      await saveMutation.mutateAsync({ apiKey: trimmed, model });
      setApiKey("");
      setReveal(false);
      toast.success("Zapisano klucz OpenAI.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        msg.startsWith("missing-encryption-key")
          ? "Serwer nie ma skonfigurowanego AGATA_SECRETS_KEY — patrz /etc/agata.env."
          : `Nie udało się zapisać klucza: ${msg}`,
      );
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync();
      toast.success("Usunięto klucz OpenAI.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="mt-4 text-sm text-muted-foreground">Ładowanie statusu klucza OpenAI…</div>
    );
  }

  const status = statusQuery.data;

  return (
    <div className="mt-4 space-y-4" data-testid="openai-key-card">
      {status?.source === "env" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" aria-hidden />
            <div>
              Klucz API OpenAI jest ustawiony w zmiennych środowiskowych serwera (
              <code className="font-mono">OPENAI_API_KEY</code> w
              <code className="font-mono"> /etc/agata.env</code>). Aby użyć innego klucza,{" "}
              <button
                type="button"
                onClick={() => setShowEnvOverride((v) => !v)}
                className="underline underline-offset-2"
              >
                {showEnvOverride ? "ukryj formularz" : "wklej własny poniżej"}
              </button>
              .
            </div>
          </div>
        </div>
      )}

      {status?.source === "stored" && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Zapisano klucz OpenAI</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                model <code className="font-mono">{status.model}</code> ·{" "}
                <code className="font-mono">{status.masked}</code>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
              Usuń
            </button>
          </div>
        </div>
      )}

      {(status?.source === "none" || (status?.source === "env" && showEnvOverride)) && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Wklej swój klucz API OpenAI. Jest szyfrowany (AES-256-GCM) i przechowywany lokalnie na
            serwerze — używany tylko do rozmów z Gigi.
          </p>
          <div className="space-y-2">
            <label htmlFor="openai-api-key" className="block text-xs font-medium">
              Klucz API OpenAI
            </label>
            <div className="relative">
              <input
                id="openai-api-key"
                type={reveal ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-… lub sk-proj-…"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 pr-10 rounded-xl border border-border bg-background text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? "Ukryj klucz" : "Pokaż klucz"}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                {reveal ? (
                  <EyeOff className="w-4 h-4" aria-hidden />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>

            <label htmlFor="openai-api-model" className="block text-xs font-medium">
              Model
            </label>
            <select
              id="openai-api-model"
              value={model}
              onChange={(e) => setModel(e.target.value as OpenAIKeyModel)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
            >
              {OPENAI_KEY_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSave}
              disabled={!isValidOpenAIKeyShape(apiKey) || saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Key className="w-4 h-4" aria-hidden />
              {saveMutation.isPending ? "Zapisuję…" : "Zapisz klucz"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors (other in-flight tasks may introduce their own — fix only this card's errors here).

- [ ] **Step 3: Commit**

```bash
git add src/components/OpenAIKeyCard.tsx
git commit -m "feat(components): OpenAIKeyCard with none/stored/env branches"
```

---

## Task 8: Update `resolver.ts` and `build-model.ts`

**Files:**

- Modify: `src/lib/gigi/resolver.ts`
- Modify: `src/lib/gigi/build-model.ts`
- Modify: `src/lib/gigi/providers/openai.ts`

**Interfaces:**

- `resolver.ts` removes `"chatgpt"`, sets default model `gpt-5.4-mini`, rewrites `notConfiguredMessage`.
- `build-model.ts` removes `tryBuildChatGPTFromStore`, adds `tryBuildOpenAIFromStore` reading `getStoredOpenAIKey()`.
- `providers/openai.ts` `DEFAULT_MODEL` → `gpt-5.4-mini`.

- [ ] **Step 1: Update `resolver.ts`**

Edit `src/lib/gigi/resolver.ts`:

1. In the comment header, drop the `"chatgpt"` mention; update precedence to mention stored key.
2. Change `GigiProviderName` to `export type GigiProviderName = "mock" | "openai" | "azure" | "ollama" | "lovable";`.
3. In `resolveGigiProvider`, delete the `if (explicit === "chatgpt") { ... }` block.
4. Change the `OPENAI_API_KEY` branch in both the explicit and implicit paths to default to `gpt-5.4-mini`:
   ```ts
   return { name: "openai", model: env.OPENAI_MODEL?.trim() || "gpt-5.4-mini", label: "OpenAI" };
   ```
5. Replace `notConfiguredMessage` body:
   ```ts
   return "Gigi nie jest jeszcze skonfigurowana. Ustaw klucz OpenAI w Ustawieniach lub OPENAI_API_KEY w /etc/agata.env. Tryb testowy: GIGI_MOCK=1.";
   ```

- [ ] **Step 2: Update `build-model.ts`**

Edit `src/lib/gigi/build-model.ts`:

1. Replace imports:
   ```ts
   import { buildOpenAIModel } from "./providers/openai";
   import { buildAzureModel } from "./providers/azure";
   import { buildLovableModel } from "./providers/lovable";
   import { createGigiMockModel } from "./mock-provider";
   import { getStoredOpenAIKey } from "@/lib/openai-key-store.server";
   ```
   (drop the `buildChatGPTModel` and `StoredToken` imports).
2. Remove `BuildGigiOptions.storedToken` and the `tryBuildChatGPTFromStore` function.
3. Replace the body of `buildGigiModel`:

```ts
export async function buildGigiModel(
  env: NodeJS.ProcessEnv = process.env,
): Promise<BuildGigiResult | null> {
  const info = resolveGigiProvider(env);
  if (info) {
    switch (info.name) {
      case "mock":
        return { provider: info, model: createGigiMockModel() };
      case "openai":
        return { provider: info, model: buildOpenAIModel(env) };
      case "azure":
        return { provider: info, model: buildAzureModel(env) };
      case "lovable":
        return { provider: info, model: buildLovableModel(env) };
      case "ollama":
        // Ollama is wired in the resolver but the chat.ts handler currently
        // doesn't have a server-side gateway for it — return null so the
        // 503 path fires (and the user sees "ollama not wired" in the
        // notConfiguredMessage hint).
        return null;
    }
  }

  // No env-only provider. Try to auto-pick from the encrypted UI key.
  return tryBuildOpenAIFromStore(env);
}
```

4. Add `tryBuildOpenAIFromStore`:

```ts
/**
 * Auto-pick OpenAI when no env provider applies AND the user has saved
 * a key in Settings (encrypted in the `settings` table). The stored
 * model is honoured so the dropdown choice persists across restarts.
 */
async function tryBuildOpenAIFromStore(env: NodeJS.ProcessEnv): Promise<BuildGigiResult | null> {
  const stored = await getStoredOpenAIKey();
  if (!stored) return null;
  const info: GigiProviderInfo = {
    name: "openai",
    model: stored.model,
    label: "OpenAI (z ustawień)",
  };
  const model = buildOpenAIModel({
    OPENAI_API_KEY: stored.apiKey,
    OPENAI_MODEL: stored.model,
  });
  return { provider: info, model };
}
```

5. Drop the `BuildGigiOptions` interface if it has no remaining callers (none expected after this change).

- [ ] **Step 3: Update `providers/openai.ts`**

In `src/lib/gigi/providers/openai.ts`, change:

```ts
const DEFAULT_MODEL = "gpt-5.4-mini";
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gigi/resolver.ts src/lib/gigi/build-model.ts src/lib/gigi/providers/openai.ts
git commit -m "feat(gigi): drop chatgpt provider, default model gpt-5.4-mini, auto-pick stored key"
```

---

## Task 9: Update `gigi.tsx` (remove OAuth gate, add banner)

**Files:**

- Modify: `src/routes/gigi.tsx`

**Interfaces:**

- Replaces `useChatgptStatusQuery` + `getGigiViewState` with `useOpenAIKeyStatusQuery`.
- Removes `GigiLoading`, `GigiOAuthGate` components.
- Adds `<GigiNoKeyBanner />` rendered above the chat when `!configured`.

- [ ] **Step 1: Rewrite the top of `gigi.tsx`**

In `src/routes/gigi.tsx`:

1. Drop imports of `ChatGPTConnectCard` and `getGigiViewState`.
2. Replace `import { Sparkles, Send, Loader2, Settings as SettingsIcon, Loader } from "lucide-react";` with:
   ```ts
   import { Sparkles, Send, Loader2, Settings as SettingsIcon, AlertCircle } from "lucide-react";
   ```
3. Replace the React-Query hooks import line to add `useOpenAIKeyStatusQuery` and remove `useChatgptStatusQuery`:
   ```ts
   import {
     useBooksQuery,
     useNotesQuery,
     useSettingQuery,
     useOpenAIKeyStatusQuery,
   } from "@/lib/api/client";
   ```
4. Delete `const chatgptStatusQuery = useChatgptStatusQuery();` and the `viewState` block. Add:
   ```ts
   const openaiKeyQuery = useOpenAIKeyStatusQuery();
   const showNoKeyBanner = openaiKeyQuery.data?.configured === false;
   ```
5. Replace the JSX body's three branches with:
   ```tsx
   {
     showNoKeyBanner && <GigiNoKeyBanner />;
   }
   <GigiChat privacyLevel={privacyLevel} books={books} notes={notes} />;
   ```
6. Delete the `GigiLoading` and `GigiOAuthGate` functions.
7. Add:
   ```tsx
   function GigiNoKeyBanner() {
     return (
       <div className="mx-4 sm:mx-5 lg:mx-10 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm flex items-start gap-2">
         <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" aria-hidden />
         <div>
           Brak klucza OpenAI — Gigi nie odpowie na wiadomości.{" "}
           <Link to="/settings" className="underline underline-offset-2">
             Ustaw go w Ustawieniach
           </Link>
           .
         </div>
       </div>
     );
   }
   ```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/gigi.tsx
git commit -m "feat(gigi): drop OAuth-first landing, show banner when no OpenAI key"
```

---

## Task 10: Update `settings.tsx`

**Files:**

- Modify: `src/routes/settings.tsx`

- [ ] **Step 1: Swap the card**

In `src/routes/settings.tsx`:

1. Replace the `ChatGPTConnectCard` import with `OpenAIKeyCard`:
   ```ts
   import { OpenAIKeyCard } from "@/components/OpenAIKeyCard";
   ```
2. Replace `<ChatGPTConnectCard />` with `<OpenAIKeyCard />` in the "Prywatność i dostęp Gigi" section.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/settings.tsx
git commit -m "feat(settings): replace ChatGPTConnectCard with OpenAIKeyCard"
```

---

## Task 11: Update existing test specs

**Files:**

- Modify: `src/lib/gigi/resolver.spec.ts`
- Modify: `src/lib/gigi/build-model.spec.ts`
- Modify: `src/lib/gigi/providers/openai.spec.ts`
- Modify: `src/routes/gigi.spec.ts`

- [ ] **Step 1: `resolver.spec.ts`**

1. Remove the four `chatgpt` test cases (search for `chatgpt` and delete the corresponding `test(...)` blocks).
2. Update the "honours OPENAI_MODEL override" test to keep using `gpt-4o` (model override is independent of the default).
3. Add a new test:
   ```ts
   test("default OPENAI model is gpt-5.4-mini", () => {
     const p = resolveGigiProvider({ OPENAI_API_KEY: "sk-test" });
     assert.equal(p?.model, "gpt-5.4-mini");
   });
   ```
4. Update the `notConfiguredMessage` regex assertion to `/OPENAI_API_KEY.*Ustawieniach|klucz OpenAI/`.

- [ ] **Step 2: `build-model.spec.ts`**

1. Drop the `chatgpt` tests (`auto-picks chatgpt…`, `OPENAI_API_KEY wins…`, `GIGI_PROVIDER=chatgpt forces…`, `GIGI_PROVIDER=chatgpt uses stored token`).
2. Replace `OPENAI_API_KEY wins over a valid chatgpt token` with `OPENAI_API_KEY env wins over a stored key`:
   ```ts
   test("OPENAI_API_KEY env wins over a stored key", async () => {
     const { getStoredOpenAIKey } = await import("@/lib/openai-key-store.server");
     (getStoredOpenAIKey as any) = async () => ({ apiKey: "sk-stored", model: "gpt-5" });
     const result = await buildGigiModel({ OPENAI_API_KEY: "sk-env" });
     assert.equal(result?.provider.name, "openai");
     // env default is still whatever OPENAI_MODEL says; we only set OPENAI_API_KEY here.
     assert.equal(result?.provider.model, "gpt-5.4-mini");
   });
   ```
3. Add a new test for stored-key auto-pick:
   ```ts
   test("auto-picks openai when no env key is set but a stored key exists", async () => {
     const { getStoredOpenAIKey } = await import("@/lib/openai-key-store.server");
     (getStoredOpenAIKey as any) = async () => ({ apiKey: "sk-stored", model: "gpt-5" });
     const result = await buildGigiModel({});
     assert.equal(result?.provider.name, "openai");
     assert.equal(result?.provider.model, "gpt-5");
   });
   ```
4. Add a `returns null when no env and no stored key` test:
   ```ts
   test("returns null when no env provider and no stored key", async () => {
     const { getStoredOpenAIKey } = await import("@/lib/openai-key-store.server");
     (getStoredOpenAIKey as any) = async () => undefined;
     const result = await buildGigiModel({});
     assert.equal(result, null);
   });
   ```

> The exact mocking shape for `getStoredOpenAIKey` depends on the project's existing test convention (look at `oauth-chatgpt-refresh.spec.ts` for the pattern — it monkey-patches the module's exports).

- [ ] **Step 3: `providers/openai.spec.ts`**

Change the default-model test:

```ts
test("defaults to gpt-5.4-mini when OPENAI_MODEL is unset", () => {
  const m = buildOpenAIModel({ OPENAI_API_KEY: "sk-test" });
  assert.equal((m as any).modelId, "gpt-5.4-mini");
});
```

- [ ] **Step 4: `gigi.spec.ts`**

1. Remove the OAuth-first cases (`"renders OAuth gate when status says not connected"`, etc.). Keep the `WELCOME` / composer / AbortController tests.
2. Add a test for the banner:
   ```ts
   test("renders GigiNoKeyBanner when /api/openai-key/status says configured: false", async () => {
     (useOpenAIKeyStatusQuery as any) = () => ({ data: { configured: false, source: "none" } });
     const { getByText } = render(<Gigi />);
     assert.match(getByText(/Brak klucza OpenAI/).textContent!, /Ustaw go w Ustawieniach/);
   });
   ```
3. Add the inverse:
   ```ts
   test("does NOT render the banner when configured: true", async () => {
     (useOpenAIKeyStatusQuery as any) = () => ({ data: { configured: true, source: "env" } });
     const { queryByText } = render(<Gigi />);
     assert.equal(queryByText(/Brak klucza OpenAI/), null);
   });
   ```

- [ ] **Step 5: Run the full unit test suite**

```bash
npm test
```

Expected: every test passes (including the new ones). Count should be ≥ 270 + new tests (likely ~25 added, ~10 removed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/gigi/resolver.spec.ts src/lib/gigi/build-model.spec.ts src/lib/gigi/providers/openai.spec.ts src/routes/gigi.spec.ts
git commit -m "test(gigi): update resolver/build-model/providers/gigi specs for api-key flow"
```

---

## Task 12: Delete OAuth files + `gigi-view-state`

**Files:**

- Delete: every file listed in the "Removed" section of the spec.

- [ ] **Step 1: Delete all listed files**

```bash
git rm \
  src/lib/gigi/oauth-chatgpt.ts \
  src/lib/gigi/oauth-chatgpt.flow.ts \
  src/lib/gigi/oauth-chatgpt.server.ts \
  src/lib/gigi/oauth-redirect-uri.ts \
  src/lib/gigi/oauth-redirect-uri-client.ts \
  src/lib/gigi/oauth-chatgpt.spec.ts \
  src/lib/gigi/oauth-chatgpt.flow.spec.ts \
  src/lib/gigi/oauth-chatgpt.server.spec.ts \
  src/lib/gigi/oauth-chatgpt-refresh.spec.ts \
  src/lib/gigi/oauth-redirect-uri.spec.ts \
  src/lib/gigi/oauth-redirect-uri-client.spec.ts \
  src/lib/gigi/providers/chatgpt.ts \
  src/lib/gigi/providers/chatgpt.spec.ts \
  src/routes/api/chatgpt/login.ts \
  src/routes/api/chatgpt/login.spec.ts \
  src/routes/api/chatgpt/callback.ts \
  src/routes/api/chatgpt/exchange.ts \
  src/routes/api/chatgpt/disconnect.ts \
  src/routes/api/chatgpt/status.ts \
  src/routes/api/chatgpt/redirect-uri.ts \
  src/components/ChatGPTConnectCard.tsx \
  src/components/chatgpt-connect-card.helpers.ts \
  src/components/chatgpt-connect-card.helpers.spec.ts \
  src/routes/gigi-view-state.ts \
  src/routes/gigi-view-state.spec.ts
```

Also `rmdir` the now-empty directories:

```bash
rmdir src/routes/api/chatgpt 2>/dev/null || true
```

If `providers` becomes empty after deletion, leave it alone — it still holds `openai.ts`, `azure.ts`, `lovable.ts`.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: every test passes.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(gigi): remove ChatGPT OAuth (Codex) flow"
```

---

## Task 13: Regenerate `routeTree.gen.ts`

**Files:**

- Modify: `src/routeTree.gen.ts` (auto-generated by TanStack Start)

- [ ] **Step 1: Run the generator**

```bash
npx tsr generate
```

(or `npm run build` — the project regenerates the tree automatically on dev/build.)

- [ ] **Step 2: Verify the new routes are registered**

```bash
grep -E "openai-key|chatgpt" src/routeTree.gen.ts
```

Expected: matches `openai-key`; **no** matches for `chatgpt`.

- [ ] **Step 3: Commit**

```bash
git add src/routeTree.gen.ts
git commit -m "chore(routes): regenerate routeTree for openai-key endpoints"
```

---

## Task 14: Update documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `deploy/README.md`
- Modify: `docs/VPS_DEPLOY.md`
- Modify: `docs/ENVIRONMENT.md`
- Modify: `docs/exit-lovable-plan.md`
- Modify: `.env.example`

- [ ] **Step 1: `CLAUDE.md`**

1. In the "Stack" section, change the `OPENAI_API_KEY` / OAuth paragraph to:
   ```
   - **Gigi works without auth** — `gigi.tsx` passes localStorage context. `/api/chat` uses
     `OPENAI_API_KEY` (env) by default, or a user-pasted OpenAI key stored encrypted in the
     `settings` table (see "OpenAI API Key" below). Optional `GIGI_SECRET`.
   ```
2. Replace the entire "Faza 2 done — Gigi przez OAuth ChatGPT" bullet with:
   ```
   - **OpenAI API Key (paste-on-page)** — `src/lib/openai-key-store.server.ts` (encrypted at
     rest via `src/lib/secrets-store.server.ts`, AES-256-GCM, key from
     `process.env.AGATA_SECRETS_KEY`). Settings UI:
     `src/components/OpenAIKeyCard.tsx`. API:
     `src/routes/api/openai-key/{status,save,delete}.ts`. Schema:
     `OpenAIKeyInputSchema` in `src/lib/api/schemas.ts` (enum of 6 models, default
     `gpt-5.4-mini`). `/gigi` shows a banner (no gate) when no key is configured.
     **VPS ops prerequisite**: `AGATA_SECRETS_KEY` must be in `/etc/agata.env` (32 random
     bytes base64). Generate with: `openssl rand -base64 32 | sudo tee -a /etc/agata.env`
     then `sudo chmod 600 /etc/agata.env && sudo systemctl restart agata`. Without it, the
     paste-on-page flow returns 500 missing-encryption-key until the operator sets it.
   ```
3. Update the env-vars block: remove `GIGI_TOKEN_KEY`, `CHATGPT_OAUTH_REDIRECT_URI`,
   `CHATGPT_OAUTH_CLIENT_ID`; add `AGATA_SECRETS_KEY`.
4. Update the "Phase 1.5 remaining" roadmap items that referenced OAuth — drop or rewrite
   any line that mentions `gigi.chatgpt.token` / `gigi.chatgpt.accountId`.

- [ ] **Step 2: `deploy/README.md`**

1. Remove the "GIGI_TOKEN_KEY" checklist item; add an "AGATA_SECRETS_KEY" item.
2. Remove the "Update CHATGPT_OAUTH_REDIRECT_URI so the OAuth flow works" section.
3. Replace the "OpenAI API key" paragraph to mention both env and UI sources.

- [ ] **Step 3: `docs/VPS_DEPLOY.md`**

1. Replace the `OPENAI_API_KEY` line in the env-vars block with the new line (note that
   UI-pasted keys are supported too).
2. Remove the `CHATGPT_OAUTH_*` lines and the `GIGI_TOKEN_KEY` line.

- [ ] **Step 4: `docs/ENVIRONMENT.md`**

Drop the OAuth env vars; add `AGATA_SECRETS_KEY`.

- [ ] **Step 5: `docs/exit-lovable-plan.md`**

Drop the Codex / `app_EMoamEEZ73f0CkXaXp7hrann` mention.

- [ ] **Step 6: `.env.example`**

1. Remove `GIGI_TOKEN_KEY`.
2. Remove `CHATGPT_OAUTH_*`.
3. Add:
   ```
   # Required for storing user-pasted OpenAI keys at rest (AES-256-GCM).
   # Generate with: openssl rand -base64 32
   AGATA_SECRETS_KEY=
   ```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md deploy/README.md docs/VPS_DEPLOY.md docs/ENVIRONMENT.md docs/exit-lovable-plan.md .env.example
git commit -m "docs: replace ChatGPT OAuth references with paste-on-page OpenAI API key"
```

---

## Task 15: Final verification

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors (warnings ok).

- [ ] **Step 3: Unit tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: `node .output/server/index.mjs` produced.

- [ ] **Step 5: Manual smoke walk-through**

Start the server with a real-shaped key placeholder:

```bash
AGATA_SECRETS_KEY=$(openssl rand -base64 32) \
DATA_DIR=/tmp/agata-walk HOST=127.0.0.1 PORT=4174 \
node .output/server/index.mjs &
```

Then exercise:

1. Visit `/settings` → "Prywatność i dostęp Gigi" → paste a fake key
   (`sk-aaaa_bbbb_cccc_dddd_eeee`) → save → toast appears → reload → key shows masked.
2. Visit `/gigi` → no banner (because key is set).
3. Click "Usuń" on the card → toast appears → banner shows on `/gigi`.
4. Send a chat message → 503 with the new notConfiguredMessage text (since the key isn't real).

Stop the server: `kill %1`.

- [ ] **Step 6: Final commit (if any docs drifted)**

```bash
git status
```

If anything is dirty, commit with `chore: post-verification cleanup`.
