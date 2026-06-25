// Regression guard for /read.
//
// Before 2026-06-25 the "Brak rozpoczętej książki" empty state sent
// users to /library and they had to drill through 3 clicks (book card
// → /book/$id/status → set "Zaczęte" → /book/$id/read) before the
// timer was reachable. That made the timer look broken. The fix: when
// the user has books in the queue, /read now renders one-click
// "Zacznij czytać" rows that flip the book to status="reading" and
// navigate to the per-book read page in a single tap.

import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const READ_PATH = fileURLToPath(new URL("./read.tsx", import.meta.url));

test("read.tsx exposes a one-click 'Zacznij czytać' for queued books", async () => {
  const src = await readFile(READ_PATH, "utf8");
  assert.match(
    src,
    /Zacznij czytać/,
    "read.tsx must render a 'Zacznij czytać' CTA when books are queued",
  );
  assert.match(
    src,
    /status:\s*"reading"/,
    "read.tsx must flip status to 'reading' on click",
  );
  assert.match(
    src,
    /\/book\/\$id\/read/,
    "read.tsx must navigate to /book/$id/read after starting",
  );
});

test("read.tsx still falls back to /library when no queue exists", async () => {
  const src = await readFile(READ_PATH, "utf8");
  assert.match(
    src,
    /Otwórz bibliotekę/,
    "read.tsx must still show the library link when the queue is empty",
  );
});

test("read.tsx redirects immediately when a book is already 'reading'", async () => {
  const src = await readFile(READ_PATH, "utf8");
  assert.match(
    src,
    /status\s*===\s*"reading"/,
    "read.tsx must auto-redirect when a book is in 'reading' status",
  );
});
