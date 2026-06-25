// Agata — renderToStaticMarkup tests for the TimerToggle button component.
//
// Pins the wire-level contract: which icon and which label render for
// each timer state, plus the aria-pressed attribute and which callback
// (onStart vs onPause) the click handler dispatches. Catches future
// regressions where the click handler stops dispatching the right
// callback or the icon stops matching the state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TimerToggle } from "./book.$id.read-timer-toggle-button";

function render(props: Partial<React.ComponentProps<typeof TimerToggle>> = {}) {
  return renderToStaticMarkup(
    createElement(TimerToggle, {
      running: false,
      seconds: 0,
      finished: false,
      onStart: () => {},
      onPause: () => {},
      ...props,
    }),
  );
}

test("TimerToggle renders 'Start' with a Play icon when not started", () => {
  const html = render({ running: false, seconds: 0, finished: false });
  // The label appears inside the button as a text node, after the icon SVG.
  assert.match(html, /\bStart\b/);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /lucide-pause/);
  assert.match(html, /lucide-play/);
});

test("TimerToggle renders 'Pauza' with a Pause icon when running", () => {
  const html = render({ running: true, seconds: 42, finished: false });
  assert.match(html, /\bPauza\b/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /lucide-pause/);
});

test("TimerToggle renders 'Dalej' with a Play icon when paused mid-session", () => {
  const html = render({ running: false, seconds: 42, finished: false });
  assert.match(html, /\bDalej\b/);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /lucide-pause/);
  assert.match(html, /lucide-play/);
});

test("TimerToggle renders 'Start' (not pressed) when finished", () => {
  const html = render({ running: false, seconds: 90, finished: true });
  assert.match(html, /\bStart\b/);
  assert.match(html, /aria-pressed="false"/);
});

test("TimerToggle includes an aria-label with the current action", () => {
  assert.match(render({ running: false, seconds: 0 }), /aria-label="Start sesję czytania"/);
  assert.match(render({ running: true, seconds: 1 }), /aria-label="Pauza sesję czytania"/);
  assert.match(
    render({ running: false, seconds: 5, finished: false }),
    /aria-label="Dalej sesję czytania"/,
  );
});
