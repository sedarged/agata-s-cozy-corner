// Agata — pure state machine for the per-book reading session timer toggle.
//
// Extracted from `book.$id.read.tsx` so the label/icon/aria logic can be
// unit-tested without rendering the full page (which depends on TanStack
// Router + React Query — too much surface for a `node:test` run).
//
// Before 2026-06-25 the page rendered three hardcoded buttons (Start / Pauza
// / Zakończ) that all stayed in the DOM, and "Start" was always visually
// highlighted — which made the timer look like it was already running and
// the other buttons unresponsive. The fix collapses Start / Pauza / Dalej
// into ONE toggle button whose label and icon reflect the current state.
// "Zakończ" stays as a separate, disabled-when-empty button.
//
// State model:
//   - `running`  : the interval is ticking
//   - `seconds`  : accumulated elapsed time
//   - `finished` : the user has clicked "Zakończ" (ready to save)
//
// Possible states (user-observable):
//   A) not started  → seconds=0,  !running, !finished
//   B) running      → seconds>0,  running,  !finished
//   C) paused       → seconds>0,  !running, !finished
//   D) finished     → seconds>0,  !running, finished
//   E) after-save   → seconds=0,  !running, !finished  (back to A)
//
// Toggle action:
//   - A → click → B (Start)
//   - B → click → C (Pauza)
//   - C → click → B (Dalej)
//   - D → click → A-then-B (Start a fresh session: zero seconds, clear
//                           finished, then start running)
//   - E → click → B (Start)

export type TimerToggleLabel = "Start" | "Pauza" | "Dalej";

export interface TimerToggleView {
  label: TimerToggleLabel;
  /** `aria-pressed` value for assistive tech. Drives the icon swap too. */
  ariaPressed: boolean;
}

/**
 * Compute the toggle button's label + pressed state from the raw timer
 * state. Pure — easy to unit-test, no React, no DOM.
 */
export function computeTimerToggle(input: {
  running: boolean;
  seconds: number;
  finished: boolean;
}): TimerToggleView {
  const { running, seconds, finished } = input;
  // D (finished) and A (not started) both render "Start" — the click
  // handler is what differentiates them (D clears the finished flag
  // and zeroes seconds before starting).
  if (running) {
    return { label: "Pauza", ariaPressed: true };
  }
  if (seconds > 0 && !finished) {
    // C — paused mid-session, can resume.
    return { label: "Dalej", ariaPressed: false };
  }
  // A (not started) or D (finished) — click toggles to running.
  return { label: "Start", ariaPressed: false };
}

/**
 * Whether the "Zakończ" button should be disabled. The user can only
 * end a session that actually has elapsed time on the clock.
 */
export function isEndButtonDisabled(input: { running: boolean; seconds: number }): boolean {
  return !input.running && input.seconds === 0;
}
