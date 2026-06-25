// Unit tests for the /api/health route. The handler is exported as a
// pure function `handleHealth(db, secretsKeyConfigured)` so we don't need
// better-sqlite3 to be compiled for the running Node version — we just
// pass a stub.
//
// M6: SQL errors must NOT leak verbatim — the handler returns the generic
// "db-unavailable" code and logs the full error server-side.
// M7: response always carries `secretsKeyConfigured` so the Settings UI
// can show the right status pill without a second roundtrip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleHealth, jsonResponse, type HealthDb } from "./health";

function fakeDb(opts: { fail: boolean; latency?: number }): HealthDb {
  return {
    prepare(_sql: string) {
      return {
        get: () => {
          if (opts.latency) {
            // Use synchronous busy-wait as a stand-in for query latency.
            const end = Date.now() + opts.latency;
            while (Date.now() < end) {
              /* spin */
            }
          }
          if (opts.fail) throw new Error("database is locked");
          return { ok: 1 };
        },
      };
    },
  };
}

test("handleHealth returns 200 + ok=true when DB responds", async () => {
  const res = handleHealth(fakeDb({ fail: false }));
  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.status, "ok");
  assert.equal(typeof body.nodeVersion, "string");
  assert.equal(typeof body.uptime, "number");
  assert.ok((body.nodeVersion as string).startsWith("v"));
  assert.ok(!Number.isNaN(Date.parse(body.timestamp as string)));
  assert.equal(typeof body.dbLatencyMs, "number");
  assert.ok((body.dbLatencyMs as number) >= 0);
});

test("handleHealth returns 503 + ok=false when DB throws (M6: sanitised error)", async () => {
  const res = handleHealth(fakeDb({ fail: true }));
  assert.equal(res.status, 503);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.status, "degraded");
  // M6: SQL errors are sanitised. The Settings / status UI never sees
  // SQLite internals.
  assert.equal(body.error, "db-unavailable");
  // The raw error must not surface anywhere in the response body.
  assert.doesNotMatch(JSON.stringify(body), /database is locked/);
  assert.equal(typeof body.timestamp, "string");
});

test("handleHealth logs the full DB error server-side (M6)", async () => {
  const logged: unknown[] = [];
  const db: HealthDb = {
    prepare() {
      return {
        get: () => {
          throw new Error("SQLITE_BUSY: database is locked");
        },
      };
    },
  };
  handleHealth(db, true, (err) => logged.push(err));
  assert.equal(logged.length, 1);
  assert.match(String(logged[0]), /SQLITE_BUSY/);
});

test("handleHealth non-Error throws are coerced to strings before logging", async () => {
  const logged: unknown[] = [];
  const db: HealthDb = {
    prepare() {
      return {
        get: () => {
          throw "raw string thrown";
        },
      };
    },
  };
  handleHealth(db, true, (err) => logged.push(err));
  assert.equal(logged.length, 1);
  assert.equal(logged[0], "raw string thrown");
});

test("handleHealth latency reflects query time", async () => {
  const res = handleHealth(fakeDb({ fail: false, latency: 30 }));
  const body = (await res.json()) as Record<string, unknown>;
  // 30ms busy-wait; allow some headroom for the perf clock granularity.
  assert.ok(
    (body.dbLatencyMs as number) >= 25,
    `expected latency >= 25ms, got ${body.dbLatencyMs}`,
  );
});

test("handleHealth surfaces secretsKeyConfigured=true when env is set (M7)", async () => {
  const res = handleHealth(fakeDb({ fail: false }), true);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.secretsKeyConfigured, true);
});

test("handleHealth surfaces secretsKeyConfigured=false when env is unset (M7)", async () => {
  const res = handleHealth(fakeDb({ fail: false }), false);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.secretsKeyConfigured, false);
});

test("handleHealth secretsKeyConfigured is present even on degraded responses", async () => {
  const res = handleHealth(fakeDb({ fail: true }), true);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.secretsKeyConfigured, true);
});

test("jsonResponse sets content-type and cache-control=no-store", () => {
  const res = jsonResponse({
    ok: true,
    status: "ok",
    nodeVersion: "v0",
    uptime: 1,
    timestamp: new Date().toISOString(),
    dbLatencyMs: 0.5,
    secretsKeyConfigured: true,
  });
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("jsonResponse honours caller headers and status", () => {
  const res = jsonResponse(
    {
      ok: false,
      status: "degraded",
      error: "db-unavailable",
      timestamp: "t",
      secretsKeyConfigured: false,
    },
    { status: 503, headers: { "x-test": "1" } },
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("x-test"), "1");
  // The hardcoded defaults must still be present alongside caller headers.
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
});

// --- L1: X-Content-Type-Options: nosniff on every health response ---

test("health 200 response sets X-Content-Type-Options: nosniff (L1)", async () => {
  const res = handleHealth(fakeDb({ fail: false }));
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("health 503 response sets X-Content-Type-Options: nosniff (L1)", async () => {
  const res = handleHealth(fakeDb({ fail: true }));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});
