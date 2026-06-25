// Agata — server functions for the OpenAI API key surface. Zod-validated.
//
// The three endpoints (`/api/openai-key/{status,save,delete}`) live as
// Nitro file routes so the same wire format is reachable from
// curl / a Settings card / a CLI paste-the-key flow. The TanStack
// `createServerFn` wrappers below are the typed RPC surface used by
// the React Query hooks in `client.ts`. Both layers share the
// `OpenAIKeyInputSchema` defined in `./schemas` so the on-the-wire
// shape and the in-process call are validated identically.
import { createServerFn } from "@tanstack/react-start";
import { OpenAIKeyInputSchema } from "@/lib/api/schemas";

/**
 * Server-side fetch (undici) can't parse relative URLs — it throws
 * "Failed to parse URL from /…" before any I/O happens. Build an
 * absolute URL from PORT/HOST (the systemd unit binds the node-server
 * to 127.0.0.1:3002 per `deploy/agata.service`); the client side is
 * unaffected because `createServerFn` doesn't run this handler in the
 * browser — it generates its own RPC stub there. The scheme is always
 * `http://` because this helper only targets the in-process loopback,
 * never the externally-served scheme behind Caddy/Cloudflare.
 *
 * Exported for unit tests; production callers go through `rpc`.
 */
export function resolveServerUrl(path: string): string {
  if (typeof window !== "undefined") return path; // defensive: rpc never runs in the browser
  // Reject anything that isn't an absolute path on the loopback — guards
  // against future callers building `path` from request data and pivoting
  // the fetch to an arbitrary internal origin.
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`resolveServerUrl: path must start with "/" (got ${JSON.stringify(path)})`);
  }
  const port = process.env.PORT ?? "3002";
  const host = process.env.HOST ?? "127.0.0.1";
  return new URL(path, `http://${host}:${port}`).toString();
}

/**
 * H1: cap the upstream fetch so a hung OpenAI / save handler can't keep
 * the Nitro event loop busy forever. 15s is generous for a 256-byte
 * POST that returns ~100 B; anything longer means the upstream is dead.
 */
export const RPC_TIMEOUT_MS = 15_000;

/**
 * M3: collapse a response body to ≤ 200 single-line characters. Full
 * body echoes leak internal state on 5xx (DB error JSON, stack traces)
 * and break log readers with embedded newlines.
 */
export function sanitizeRpcErrorBody(body: string): string {
  if (!body) return "";
  const oneLine = body.replace(/[\r\n]+/g, " ").trim();
  if (oneLine.length <= 200) return oneLine;
  return oneLine.slice(0, 199) + "…";
}

/**
 * Thin `fetch` wrapper that turns non-2xx responses into thrown
 * errors. The cookie comment from the previous version was wrong —
 * `credentials: "same-origin"` is a no-op for cross-port loopback
 * fetch (the Cloudflare Access cookie lives on the external host,
 * not on 127.0.0.1:3002), so the option is dropped.
 *
 * H1 / M3: wraps `fetch` in an AbortController with a hard timeout,
 * and sanitises the body string before composing the thrown error.
 */
async function rpc<T>(url: string, init?: RequestInit): Promise<T> {
  const absoluteUrl = resolveServerUrl(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(absoluteUrl, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${absoluteUrl} ${res.status}: ${sanitizeRpcErrorBody(body)}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    // Re-throw AbortError as a friendly Polish message — the upstream
    // hang shouldn't surface as the raw undici error.
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Przekroczono czas żądania (${RPC_TIMEOUT_MS} ms): ${absoluteUrl}`);
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

export interface OpenAIKeyStatus {
  configured: boolean;
  source: "env" | "stored" | "none";
  model?: string;
  masked?: string;
}

export const getOpenAIKeyStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<OpenAIKeyStatus> => rpc<OpenAIKeyStatus>("/api/openai-key/status"),
);

export const saveOpenAIKey = createServerFn({ method: "POST" })
  .validator(OpenAIKeyInputSchema)
  .handler(async ({ data }) => {
    return rpc<{ ok: true; model: string; masked: string }>("/api/openai-key/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  });

export const deleteOpenAIKey = createServerFn({ method: "POST" }).handler(async () =>
  rpc<{ ok: true }>("/api/openai-key/delete", { method: "POST" }),
);
