// Agata — tests for the pure timer toggle state machine.
//
// Pinned because before 2026-06-25 the /book/$id/read page rendered
// three hardcoded buttons (Start / Pauza / Zakończ) with "Start" always
// visually highlighted, which made the timer look like it was already
// running. The fix is a single toggle button whose label reflects the
// current state — these tests pin that contract.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeTimerToggle, isEndButtonDisabled } from "./book.$id.read-timer-toggle";

describe("computeTimerToggle", () => {
  it("A — not started renders 'Start', not pressed", () => {
    const view = computeTimerToggle({ running: false, seconds: 0, finished: false });
    assert.equal(view.label, "Start");
    assert.equal(view.ariaPressed, false);
  });

  it("B — running renders 'Pauza', pressed", () => {
    const view = computeTimerToggle({ running: true, seconds: 42, finished: false });
    assert.equal(view.label, "Pauza");
    assert.equal(view.ariaPressed, true);
  });

  it("B' — running with zero elapsed seconds (transient, just after a fresh start) still shows 'Pauza'", () => {
    // Reachable for one tick: user clicks "Start" from state D (finished)
    // → handler sets running=true, seconds=0, finished=false. The next
    // render shows "Pauza" with the timer at 0:00:00. Pinned so a future
    // refactor can't accidentally downgrade the running state to "Start".
    const view = computeTimerToggle({ running: true, seconds: 0, finished: false });
    assert.equal(view.label, "Pauza");
    assert.equal(view.ariaPressed, true);
  });

  it("C — paused mid-session renders 'Dalej', not pressed", () => {
    const view = computeTimerToggle({ running: false, seconds: 42, finished: false });
    assert.equal(view.label, "Dalej");
    assert.equal(view.ariaPressed, false);
  });

  it("D — finished renders 'Start' (click clears finished + starts fresh)", () => {
    // After the user clicks "Zakończ", the toggle reverts to "Start" so
    // the next click can begin a new session.
    const view = computeTimerToggle({ running: false, seconds: 90, finished: true });
    assert.equal(view.label, "Start");
    assert.equal(view.ariaPressed, false);
  });

  it("E — after-save (seconds=0, !running, !finished) renders 'Start'", () => {
    const view = computeTimerToggle({ running: false, seconds: 0, finished: false });
    assert.equal(view.label, "Start");
    assert.equal(view.ariaPressed, false);
  });
});

describe("isEndButtonDisabled", () => {
  it("disabled when not running and no time elapsed (nothing to end)", () => {
    assert.equal(isEndButtonDisabled({ running: false, seconds: 0 }), true);
  });

  it("enabled while running (can stop the timer)", () => {
    assert.equal(isEndButtonDisabled({ running: true, seconds: 0 }), false);
  });

  it("enabled when paused with elapsed time (can wrap up)", () => {
    assert.equal(isEndButtonDisabled({ running: false, seconds: 1 }), false);
  });
});
