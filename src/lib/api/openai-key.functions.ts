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
 * Thin `fetch` wrapper that prefixes relative URLs (so this works the
 * same in dev and when called from a node-server prod build where
 * `fetch` against a relative path resolves to the in-process Nitro
 * server) and surfaces non-2xx responses as thrown errors. The
 * `credentials: "same-origin"` is required so the cookie sent by the
 * Cloudflare Access gate (when deployed behind the tunnel) is carried
 * through; in single-user Tailscale mode the cookie is absent and the
 * default fetch behaviour applies.
 */
async function rpc<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${url} ${res.status}${body ? `: ${body}` : ""}`);
  }
  return (await res.json()) as T;
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
