# Agata — 20-Step Prioritized Roadmap (revised)

Gigi is moved to the end and reframed as **your personal ChatGPT connected via OAuth** (per-user OAuth, not a workspace connector — each user signs in with their own ChatGPT/OpenAI account).

## Phase A — Stability & data safety (do first)

1. **Backup / Export / Import (JSON)** — export all local stores (`agata-books-v1`, `agata-book-notes-v1`, `agata-reading-sessions-v1`, `agata-book-state-v1`); import with merge or replace. Protects against browser data wipe.
2. **Storage quota guard** — catch `QuotaExceededError`, show a Polish error, suggest export + cleanup.
3. **Image compression audit** — every cover, note photo and handwriting PNG downscaled (max 1600px, JPEG 0.8) before persist.
4. **Global error boundary** — Polish fallback screen with "Spróbuj ponownie" + export link.
5. **Schema versioning + migrations** — `version` field per store, single `migrate()` runner. Required before any further data-shape changes.

## Phase B — Core UX gaps

6. **Reading session editor** — edit/delete past sessions, fix wrong page counts.
7. **Global notes & quotes search** — real search, filter by book/tag/type, sort, on `/notes` and `/quotes`.
8. **Tags + chapter assignment in the note editor** — not only from the chapters tab.
9. **Book status flow polish** — queue → reading → finished → favourite with date stamps, visible on book card.
10. **Fuzzy duplicate detection** — normalize diacritics / case / punctuation on title+author, in addition to ISBN.

## Phase C — Insights & motivation

11. **Statistics dashboard upgrade** — weekly/monthly time, pages/day, streak, books finished per month, all from local sessions.
12. **Goals** — yearly book goal + weekly minutes goal, progress ring on dashboard.
13. **Year-in-review screen** — shareable summary (top books, total pages, total time, favourite quotes).

## Phase D — iPad & handwriting delight

14. **Handwriting toolbar v2** — pen sizes, eraser, undo/redo, 3 ink colors, optional pressure; per-note background (lines/grid/blank).
15. **iPad split layout for Book Workspace** — two-pane (notes list | editor) at ≥1024px, mobile unchanged.
16. **Local recommendations v1 (no AI)** — score candidates by shared author / genre / rating from the library; replaces today's mock "Polecane".
17. **PWA install + offline** — manifest, icons, service worker for app shell + assets so Agata can use it offline on iPad. Must exclude `/~oauth` from the SW.

## Phase E — Gigi = personal ChatGPT via OAuth (last)

18. **Auth foundation** — add Lovable Cloud auth (email + Google) so each user has an account to attach a ChatGPT connection to. Required before per-user OAuth.
19. **ChatGPT OAuth connection per user** — implement OpenAI OAuth flow, store the user's tokens server-side (encrypted), refresh handling, "Połącz z ChatGPT" / "Rozłącz" screen in settings.
20. **Gigi chat using the user's ChatGPT** — `/gigi` Polish chat UI; server function calls OpenAI with the connected user's token, sends library context (books, status, ratings, recent notes), returns recommendations + "Dodaj do kolejki" one-tap action.

## Notes

- Steps 1, 2, 3, 5 unblock everything else — keep that order.
- Step 16 gives Agata real (non-mock) recommendations even before Gigi exists.
- Step 17 (PWA) lands before Gigi so OAuth can be tested against the final service-worker setup.
- Step 18 (auth) is a hard prerequisite for 19–20; per-user OAuth needs a user identity to bind tokens to.
- OpenAI does not currently expose a public end-user OAuth for ChatGPT-the-product; if at implementation time only API-key BYOK is feasible, step 19 becomes "user pastes their OpenAI API key, stored encrypted per user" with the same UX. I'll confirm the exact mechanism before building step 19.

Tell me which step to start with and I'll implement it.
