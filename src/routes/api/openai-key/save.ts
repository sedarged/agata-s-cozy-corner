// Agata — `POST /api/openai-key/save`
//
// Validates the body with OpenAIKeyInputSchema and persists the key
// (encrypted) + model (plaintext) to the settings store. Returns the
// masked key so the UI can update its state without a refetch.
//
// H2: CSRF defense-in-depth — the Cloudflare Access edge already protects
// the public hostname, but the loopback handler also rejects requests with
// an Origin that doesn't match the configured AGATA_PUBLIC_ORIGIN (or any
// Tailscale tailnet host). The check is a no-op for curl/server-to-server
// calls that send neither Origin nor Referer.
//
// H5: the encrypt path can fail in ways that leak the DATA_DIR (e.g. an
// unhandled ENOENT). We catch every error from saveOpenAIKey, log the full
// error server-side (so the operator can diagnose) and return a generic
// `{ error: "save-failed" }` to the client — never the underlying message.
import { createFileRoute } from "@tanstack/react-router";

import { OpenAIKeyInputSchema } from "@/lib/api/schemas";
import { saveOpenAIKey } from "@/lib/openai-key-store.server";
import { maskOpenAIKey } from "@/components/OpenAIKeyCard.helpers";

/**
 * Origin/Referer gate for state-changing POSTs. Returns true when:
 * - the request has no Origin AND no Referer (server-to-server / curl), OR
 * - the Origin host matches `allowedOriginHost` (e.g. `mycozylibary.com` or
 *   the Tailscale tailnet FQDN), OR
 * - the Referer host matches `allowedOriginHost`.
 *
 * The check is intentionally permissive for same-origin browser requests
 * (they always send an Origin) and for ops curl (neither header). It's
 * hostile to cross-site form submissions because browsers always send an
 * Origin on POST.
 */
export function isAllowedOrigin(request: Request, allowedOriginHost: string | null): boolean {
  if (!allowedOriginHost) return true; // operator hasn't configured — permissive
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) return true; // curl / server-to-server
  try {
    const host = origin ? new URL(origin).host : referer ? new URL(referer).host : "";
    return host === allowedOriginHost;
  } catch {
    return false;
  }
}

export interface HandleSaveDeps {
  saveOpenAIKey?: typeof saveOpenAIKey;
  allowedOriginHost?: string | null;
  logError?: (err: unknown) => void;
}

/**
 * Pure handler so tests can drive it without spinning up the route.
 * Pass `deps.saveOpenAIKey` to mock the persistence layer, `deps.allowedOriginHost`
 * to lock the CSRF gate, and `deps.logError` to silence the console in tests.
 */
export async function handleSave(request: Request, deps: HandleSaveDeps = {}): Promise<Response> {
  const save = deps.saveOpenAIKey ?? saveOpenAIKey;
  const allowedOriginHost =
    deps.allowedOriginHost === undefined
      ? process.env.AGATA_PUBLIC_ORIGIN
        ? new URL(process.env.AGATA_PUBLIC_ORIGIN).host
        : null
      : deps.allowedOriginHost;
  const logError = deps.logError ?? ((err: unknown) => console.error("[openai-key/save]", err));

  if (!isAllowedOrigin(request, allowedOriginHost)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = OpenAIKeyInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", details: parsed.error.issues }, { status: 400 });
  }
  try {
    await save(parsed.data);
  } catch (err) {
    logError(err);
    if (err instanceof Error && err.message.startsWith("AGATA_SECRETS_KEY")) {
      // The Settings UI calls classifySaveError which matches the
      // structured-JSON code; keep this branch public so the user gets
      // a friendly hint instead of "save-failed".
      return Response.json({ error: "missing-encryption-key" }, { status: 500 });
    }
    return Response.json({ error: "save-failed" }, { status: 500 });
  }
  return Response.json({
    ok: true,
    model: parsed.data.model,
    masked: maskOpenAIKey(parsed.data.apiKey),
  });
}

export const Route = createFileRoute("/api/openai-key/save")({
  server: {
    handlers: {
      POST: ({ request }) => handleSave(request),
    },
  },
});
