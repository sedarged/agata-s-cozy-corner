// Unit tests for the /api/health route. The handler is exported as a
// pure function `handleHealth(db)` so we don't need better-sqlite3 to
// be compiled for the running Node version — we just pass a stub.
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
  assert.equal(typeof body.timestamp, "string");
  assert.equal(typeof body.nodeVersion, "string");
  assert.equal(typeof body.uptime, "number");
  assert.ok((body.nodeVersion as string).startsWith("v"));
  assert.ok(!Number.isNaN(Date.parse(body.timestamp as string)));
  assert.equal(typeof body.dbLatencyMs, "number");
  assert.ok((body.dbLatencyMs as number) >= 0);
});

test("handleHealth returns 503 + ok=false when DB throws", async () => {
  const res = handleHealth(fakeDb({ fail: true }));
  assert.equal(res.status, 503);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.status, "degraded");
  assert.equal(typeof body.error, "string");
  assert.ok((body.error as string).length > 0);
  assert.equal(typeof body.timestamp, "string");
});

test("handleHealth captures the thrown error message verbatim", async () => {
  const db: HealthDb = {
    prepare() {
      return { get: () => { throw new Error("SQLITE_BUSY: database is locked"); } };
    },
  };
  const res = handleHealth(db);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "SQLITE_BUSY: database is locked");
});

test("handleHealth non-Error throws are coerced to strings", async () => {
  const db: HealthDb = {
    prepare() {
      return { get: () => { throw "raw string thrown"; } };
    },
  };
  const res = handleHealth(db);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.error, "raw string thrown");
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

test("jsonResponse sets content-type and cache-control=no-store", () => {
  const res = jsonResponse({
    ok: true,
    status: "ok",
    nodeVersion: "v0",
    uptime: 1,
    timestamp: new Date().toISOString(),
    dbLatencyMs: 0.5,
  });
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("jsonResponse honours caller headers and status", () => {
  const res = jsonResponse(
    { ok: false, status: "degraded", error: "x", timestamp: "t" },
    { status: 503, headers: { "x-test": "1" } },
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("x-test"), "1");
  // The hardcoded defaults must still be present alongside caller headers.
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
});