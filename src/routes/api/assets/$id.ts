// Agata — asset streaming endpoint.
// `GET /api/assets/:id` reads the asset row from SQLite and streams the bytes
// from $DATA_DIR/assets/<id>.<ext>. Used by cover photos, page snapshots, and
// hand-drawn attachments. No auth — single-user VPS over Tailscale.
//
// The mime from the DB is verified against a small allowlist before being
// served back. This blocks an attacker (or a buggy import) from ever getting
// the server to echo `text/html` or `application/javascript` — which would
// turn a same-origin GET into stored XSS. Unknown mimes degrade to
// `application/octet-stream`.
//
// NOTE: image/svg+xml is intentionally NOT allowed — SVG can carry <script>
// and <foreignObject>. Cover photos are JPEG/WebP after the
// `compressCoverFile` pipeline.
import { createFileRoute } from "@tanstack/react-router";
import { readAssetBytes } from "@/lib/db/repositories/assets";

const ALLOWED_MIMES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/octet-stream",
]);

function safeMime(mime: string | null | undefined): string {
  if (mime && ALLOWED_MIMES.has(mime)) return mime;
  return "application/octet-stream";
}

function notFound(): Response {
  return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain" } });
}

function badRequest(msg: string): Response {
  return new Response(msg, { status: 400, headers: { "content-type": "text/plain" } });
}

export const Route = createFileRoute("/api/assets/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!id || typeof id !== "string" || id.length > 128 || !/^[A-Za-z0-9._-]+$/.test(id)) {
          return badRequest("Invalid asset id");
        }
        const result = await readAssetBytes(id);
        if (!result) return notFound();
        // Convert Node Buffer to a Web ReadableStream that Response can serve.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(result.bytes));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            "content-type": safeMime(result.row.mime),
            "content-length": String(result.row.bytes),
            "cache-control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
