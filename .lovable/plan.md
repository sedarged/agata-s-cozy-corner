## Gap audit — what the last pass missed or did partially

Verified done: notes-store (`deletedIds`, `deleteNote`, `{ok,quota}`), `book-workspace-store` (state/sessions/drafts/`compressImageFile`/`useWorkspaceVersion`), photo compression, draft autosave+recovery, leave-guard + `beforeunload`, delete-with-modal, `Wyczyść` confirmation, reading-session persistence with `currentPage` advance, status persistence, stats using combined sessions, dashboard rating/favourite/opinion editor, `useNotesVersion`/`useWorkspaceVersion` reactivity, Polish labels.

Gaps to close:

1. **Phase 5 — "Pełny ekran pisania" focus mode** never added.
2. **Phase 5 — in-session strokes lost when toggling Tekst ↔ Pismo ręczne.** The canvas unmounts; only the saved `drawingDataUrl` baseline is reloaded, so unsaved strokes vanish silently.
3. **Phase 9 — `opinion` not reflected on dashboard.** `getEffectiveBook` exposes status/currentPage/rating/favourite but not `opinion`, so the saved opinion never appears under "Moja ocena" (only inside the editor while open).
4. **Phase 7 — `startedAt` / `finishedAt` timestamps** are never written. Required fields in `BookUserState` per Phase 1.
5. **Phase 11 — invalid book id** crashes `status.tsx`, `read.tsx`, `stats.tsx`, `book.$id.index.tsx` because they use `getEffectiveBook(id)!`. Need a Polish glass fallback.
6. **Phase 13 — browser flow verification** was not actually executed.
7. **Phase 14 — build/typecheck confirmation.** Typecheck passed locally; full build was not run/confirmed.
8. **Phase 12 — responsive checks at 390/430/768** were not performed.

## Plan

### 1. Handwriting focus mode + stroke preservation (`src/components/HandwritingCanvas.tsx`, `src/components/NoteEditor.tsx`)

- Add `Pełny ekran pisania` button to the toolbar. Toggles a fixed full-viewport overlay (`fixed inset-0 z-50 bg-[var(--bg)]`) containing the same canvas instance. Exit button labelled `Zamknij`. Keep toolbar inside the overlay so all tools work. No layout duplication — same `<canvas>` element re-parented via a portal-style wrapper (conditional class swap on the existing wrap div).
- Stroke preservation: expose `toDataUrl()` on the canvas handle (already present). In `NoteEditor`, when the user clicks the Tryb toggle, before unmounting the canvas, snapshot the current canvas via `canvasRef.current.toDataUrl()` and store it as the next `initialDrawingForCanvas`. When toggling back to `Pismo ręczne`, the snapshot reloads exactly where they left off.

### 2. Opinion sync on dashboard (`src/lib/book-workspace-store.ts`, `src/routes/book.$id.index.tsx`)

- Add `opinion` to the object returned by `getEffectiveBook` (read from `BookUserState.opinion`, fall back to undefined).
- In the dashboard, read `book.opinion` (with the augmented type) for the read-only "Moja ocena" view so the saved opinion shows after refresh.

### 3. `startedAt` / `finishedAt` (`src/lib/book-workspace-store.ts`, `src/routes/book.$id.status.tsx`, `src/routes/book.$id.read.tsx`)

- In `updateBookState`, when patch sets `status` to `reading` and prev `startedAt` is empty, set `startedAt = nowIso()`.
- When patch sets `status` to `finished` and prev `finishedAt` is empty, set `finishedAt = nowIso()`.
- In `read.tsx` save flow, when auto-promoting status `queue → reading`, this is handled automatically by the rule above.

### 4. Invalid book / note id guards (`src/routes/book.$id.index.tsx`, `book.$id.status.tsx`, `book.$id.read.tsx`, `book.$id.stats.tsx`)

- Replace `getEffectiveBook(id)!` with a guarded check; when undefined, render the existing glass "Nie znaleziono książki" card with a `Wróć do biblioteki` link (`/library`). Matches the pattern already used in `book.$id.tsx` parent and `notes.$noteId.tsx`.

### 5. Phase 12 — responsive verification

- Use `browser--view_preview` at `/book/1`, `/book/1/notes/new`, `/book/1/read`, `/book/1/stats` at widths 390, 430 and 768. Confirm no horizontal scroll, toolbar wraps, canvas usable, modals fit. Tighten any flex/grid breakpoints found (likely none).

### 6. Phase 13 — browser flow verification

- Drive flows via `browser--act` on the running preview:
  - notes: create typed, create handwritten, create with photo, edit, delete custom, delete mock + refresh, restore draft, discard draft, verify counts update on dashboard.
  - reading: start/pause/finish, enter pages, save, confirm session in `/stats` and dashboard time/progress.
  - book state: change status, refresh; save rating/favourite/opinion, refresh.
- Capture any runtime issues and patch.

### 7. Phase 14 — final checks

- `bunx tsc --noEmit` (target: clean).
- Let the harness build; surface and fix any TS/build errors.
- Confirm lint script status (none configured in `package.json` — report explicitly).

## Out of scope (kept as-is)

- Home page, header, drawer, route structure, mock-data canonical fields (`pageCount`, `currentPage`), backend, auth, new dependencies.
- NoteCard delete button (intentionally kept on the edit page only, per Phase 2 fallback).

## Final response format

Files changed · localStorage keys · routes verified · behaviors implemented · browser flows verified · build/typecheck result · lint status · known limitations.
