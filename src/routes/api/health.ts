// /api/health — lightweight HTTP health probe for external monitors
// (uptime checkers, Prometheus blackbox, k8s liveness probes).
//
// Two response shapes:
//   - 200 + { ok: true, secretsKeyConfigured: bool, ... } when the server
//     can talk to SQLite
//   - 503 + { ok: false, error: "db-unavailable", secretsKeyConfigured: bool, ... }
//     otherwise (liveness/readiness fail)
//
// We deliberately avoid the full `getServerHealth` server function here
// because that one does row counts on every table — fine for a 30-second
// UI refresh, but a 5-second probe would hammer the DB. This route
// does the bare minimum: confirm the DB connection is alive.
//
// M6: SQL errors are sanitised — the response carries a generic code so
// attackers can't harvest SQLite internals; the full error is logged
// server-side for the operator.
// M7: `secretsKeyConfigured` is always in the payload so the Settings
// status pill can render the right state without a second roundtrip.
import { createFileRoute } from "@tanstack/react-router";
import { getRawSqlite } from "@/lib/db";

interface HealthOk {
  ok: true;
  status: "ok";
  nodeVersion: string;
  uptime: number;
  timestamp: string;
  dbLatencyMs: number;
  secretsKeyConfigured: boolean;
}

interface HealthErr {
  ok: false;
  status: "degraded";
  error: "db-unavailable";
  timestamp: string;
  secretsKeyConfigured: boolean;
}

export type Health = HealthOk | HealthErr;

/**
 * Build a JSON Response with the right headers. Pure (no I/O) so it can
 * be exercised by tests.
 */
export function jsonResponse(data: Health, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

/** Minimal interface the handler needs from the DB. */
export interface HealthDb {
  prepare(sql: string): { get(): unknown };
}

/**
 * Pure request handler. Accepts an injected DB so tests can run without
 * better-sqlite3 being compiled for the current Node version.
 *
 * `secretsKeyConfigured` defaults to the runtime env (`AGATA_SECRETS_KEY`
 * presence). Tests inject the value directly to keep them hermetic.
 *
 * `logError` defaults to `console.error`; tests inject a spy.
 */
export function handleHealth(
  db: HealthDb,
  secretsKeyConfigured: boolean = Boolean(process.env.AGATA_SECRETS_KEY),
  logError: (err: unknown) => void = (err) => console.error("[api/health]", err),
): Response {
  const ts = new Date().toISOString();
  const t0 =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  try {
    db.prepare("SELECT 1 AS ok LIMIT 1").get();
    const latencyMs =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? Math.round((performance.now() - t0) * 100) / 100
        : 0;
    const body: HealthOk = {
      ok: true,
      status: "ok",
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      timestamp: ts,
      dbLatencyMs: latencyMs,
      secretsKeyConfigured,
    };
    return jsonResponse(body);
  } catch (e) {
    logError(e);
    const body: HealthErr = {
      ok: false,
      status: "degraded",
      error: "db-unavailable",
      timestamp: ts,
      secretsKeyConfigured,
    };
    return jsonResponse(body, { status: 503 });
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => handleHealth(getRawSqlite() as unknown as HealthDb),
    },
  },
});
