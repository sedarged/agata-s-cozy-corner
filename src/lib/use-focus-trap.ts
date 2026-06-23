// useFocusTrap — minimal, dependency-free focus trap + Escape handler
// for full-screen custom modals (HandwritingCanvas, BackupPanel, NoteEditor
// delete-confirm, EditBookModal). Use when a Radix <Dialog> is overkill.
//
// Behaviour:
//  - on mount: remember `document.activeElement`, focus the first focusable
//    element inside the trap (or the container itself).
//  - Tab / Shift+Tab cycle within `containerRef.current`.
//  - Escape fires `onEscape` (caller decides: close? cancel?).
//  - on unmount: restore focus to the previously active element.
//
// This is intentionally small — we don't need focus-restoration to nested
// modals or aria-hidden siblings (Radix handles that for the
// Dialog/AlertDialog primitives we use everywhere else).
import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  onEscape: () => void,
  enabled = true,
) {
  // Stash the latest onEscape in a ref so the document-level keydown
  // listener doesn't need to be torn down and re-bound on every parent
  // re-render (a new closure from `onClose={() => setOpen(false)}` would
  // otherwise reset the effect each render and re-capture the wrong
  // `previouslyFocused`).
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("aria-hidden") && el.tabIndex !== -1,
      );

    const initial = focusables()[0] ?? container;
    // Defer so the modal finishes rendering before we steal focus.
    const t = window.setTimeout(() => initial.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      // The original element may have been unmounted (e.g. the trigger
      // button was conditionally rendered). `focus()` throws on detached
      // nodes in modern Chromium, so swallow.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          /* element detached */
        }
      }
    };
  }, [containerRef, enabled]);
}
