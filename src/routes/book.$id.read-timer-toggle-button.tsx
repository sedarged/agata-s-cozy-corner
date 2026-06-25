// Agata — TimerToggle button component for the per-book reading page.
//
// Single toggle that swaps its label/icon based on the timer state
// machine in `./book.$id.read-timer-toggle.ts`. Replaces the previous
// three hardcoded buttons (Start / Pauza / Zakończ) that all stayed
// rendered with "Start" always visually highlighted — which made the
// timer look like it was already running and the buttons unresponsive.
import { Play, Pause } from "lucide-react";

import { computeTimerToggle } from "./book.$id.read-timer-toggle";

export function TimerToggle(props: {
  running: boolean;
  seconds: number;
  finished: boolean;
  onStart: () => void;
  onPause: () => void;
}) {
  const { running, seconds, finished, onStart, onPause } = props;
  const view = computeTimerToggle({ running, seconds, finished });
  const Icon = view.ariaPressed ? Pause : Play;
  // `onStart` is the user's "begin / resume" intent; `onPause` is the
  // user's "stop the clock, stay on this page" intent. The parent's
  // `finished` → `onStart` path zeroes seconds + clears finished before
  // calling, so the state machine is always re-evaluated on the next
  // render with consistent input.
  const handleClick = () => {
    if (view.ariaPressed) {
      onPause();
    } else {
      onStart();
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-5 py-2.5 rounded-full bg-[var(--accent-gold)] text-[var(--bg)] text-sm inline-flex items-center gap-2"
      aria-label={`${view.label} sesję czytania`}
      aria-pressed={view.ariaPressed}
    >
      <Icon className="w-4 h-4" aria-hidden="true" /> {view.label}
    </button>
  );
}
