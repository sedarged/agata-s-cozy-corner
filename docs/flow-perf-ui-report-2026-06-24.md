# Agata — Flow, Performance, and UI Walkthrough Report

**Date:** 2026-06-24
**Walkthrough host:** 127.0.0.1:4174 (NODE_ENV=production, `.output/server/index.mjs`)
**Walkthrough data:** `/tmp/agata-walk/agata.db` (seed + override rows)
**Build:** post-refactor of `src/routes/add-book.tsx` (duplicate-guard helper extracted)
**Test suite at report time:** 333/333 unit tests pass · TypeScript 0 errors · ESLint 0 problems

## Scope

End-to-end exercise of every route the user touches in a normal session, with attention to:

1. **Functional correctness** — does each click do what its label promises?
2. **Performance** — DCL, Load, FCP, route transitions, server round-trips.
3. **Responsive UX** — 375 px (mobile) and 1280 px (desktop) viewports.
4. **Edge cases** — duplicate detection, "Dodaj mimo to" override, empty/error states.

## Routes walked

| Route                 | Mobile 375 px | Desktop 1280 px | Notes                                                                |
| --------------------- | ------------- | --------------- | -------------------------------------------------------------------- |
| `/` (home)            | ok            | ok              | Reads `useBooksQuery()` + `useSessionsQuery()` (Phase 1.5 migrated). |
| `/library`            | ok            | ok              | 4 books render (seed + 3 overrides from walk).                       |
| `/book/$id`           | ok            | ok              | Title, author, status, tabs (Notatki / Statystyki / Stan).           |
| `/add-book`           | ok            | ok              | Duplicate detection fires; "Dodaj mimo to" creates 2nd copy.         |
| `/notes`              | ok            | ok              | Filter selects no longer overflow at 375 px (regression-pinned).     |
| `/quotes`             | ok            | ok              | Same filter contract as /notes.                                      |
| `/reading`            | ok            | ok              | Tabs render; session timeline visible.                               |
| `/stats`              | ok            | ok              | Year-in-review + per-book progress.                                  |
| `/gigi`               | ok            | ok              | OAuth-first landing when status === needs-oauth.                     |
| `/settings`           | ok            | ok              | MigrateToServerCard + Theme + Gigi privacy.                          |
| `/api/health`         | n/a           | n/a             | Returns `{ok: true}` with DB counts.                                 |
| `/api/chatgpt/status` | n/a           | n/a             | Returns `{connected: false}` (no OAuth on this VPS).                 |

## Performance measurements

Measured against the production build at `127.0.0.1:4174`, viewport 1280 × 720, network unthrottled.

| Route       | DCL  | Load | FCP   | Network requests                          |
| ----------- | ---- | ---- | ----- | ----------------------------------------- |
| `/` (home)  | 44ms | 73ms | 432ms | 2 serverFn RPCs (listBooks, listSessions) |
| `/library`  | 50ms | 71ms | 532ms | 1 serverFn RPC (listBooks)                |
| `/book/$id` | 44ms | 65ms | 410ms | 1 serverFn RPC (getBook) + invalidate     |
| `/add-book` | 41ms | 62ms | 380ms | 1 serverFn RPC (listBooks for dup check)  |
| `/notes`    | 38ms | 58ms | 365ms | 1 serverFn RPC (listNotes)                |
| `/gigi`     | 39ms | 60ms | 388ms | 1 fetch `/api/chatgpt/status`             |

All targets well within the "feels instant" budget (< 100 ms DCL, < 600 ms FCP).
React Query `staleTime: 30_000` keeps navigations between Library → Book → Library from re-firing RPCs the user just made.

## add-book duplicate-guard + override — verified end-to-end

This was the focus of the refactor. Both halves of the contract were walked against the rebuilt code:

### Flow

1. Navigate to `/add-book`. Search "Pan Tadeusz" — 8+ results from Open Library, cover thumbnails may 404 (OL hosts them lazily).
2. Click first "Zobacz szczegóły i dodaj" — ResultCard opens, shows full book details (title, author, year, page count, publisher).
3. Click "Dodaj do biblioteki" — because `seed-book-1` (Pan Tadeusz, isbn 9788373271920) is already in the library, `decideAddAction({force: false})` returns `{kind: "duplicate", book}` and the card swaps to the duplicate UI:

   > **Ta książka jest już w bibliotece**
   > Pan Tadeusz — Adam Mickiewicz
   > [Otwórz książkę] [Dodaj mimo to] [Anuluj]

4. Click "Dodaj mimo to" — `decideAddAction({force: true})` returns `{kind: "proceed", input}` and `createBook.mutateAsync({data: input})` runs with a fresh `genId("b")`.
5. Server returns the new book id, React Router navigates to `/book/b-<uuid>`. Detail page renders the new book (title, author, status="W kolejce").
6. SQLite confirms two rows now share the seed's isbn/title/author with different ids:

   ```
   seed-book-1                              | 9788373271920 | 2026-06-24T23:00:00Z
   b-11a24769-c75d-4bae-b22e-6f7146acbdb1   | 9788373271920 | 2026-06-24T23:46:01Z
   ```

### Regression coverage

- 9 unit tests in `src/lib/add-book.spec.ts` pin the contract at the pure-decision layer:
  - 5 lookup tests (isbn match, title+author match, author-mismatch no-match, sparse-query no-match, Polish diacritic bidirectional match)
  - 4 decision tests (non-duplicate → proceed, isbn-duplicate → duplicate, title+author duplicate → duplicate, force=true bypass preserves new id)

The single source of truth is `src/lib/add-book.ts`; `src/routes/add-book.tsx` imports the helpers via `useIsDuplicateBook` and from each click handler (SearchTab, IsbnTab, ManualTab) — no parallel implementation to drift.

## Polish diacritic handling — bug found and fixed during this walk

The initial refactor used only `NFKD + /\p{M}+/gu` (Unicode combining-mark strip) for normalization. Walkthrough revealed this is **insufficient** for Polish `ł` (U+0142), which has no NFKD decomposition at all — a library book stored as "Bolesław Prus" would not collide with a search result of "Boleslaw Prus".

**Fix:** added a small Polish-specific transliteration table to `normDup` for `ł/Ł/ą/Ą/ć/Ć/ę/Ę/ń/Ń/ó/Ó/ś/Ś/ź/Ź/ż/Ż`. Both directions verified by the new "matches across Polish diacritics (both directions)" test.

## UX observations (not blocking, future improvements)

1. **Duplicate UI on empty library** — when the library has 0 books, the duplicate detector is trivially empty and the flow goes straight to upsertBook. With 1+ books, the inline duplicate UI is concise and discoverable.
2. **Polish diacritic mismatch between Open Library and user input** — solved at the normalization layer; no UI affordance needed.
3. **Search results with missing cover** — shows "Brak okładki" placeholder; click target still works (the button is on the right).
4. **Google Books rate-limit (no API key)** — `/etc/agata.env` is missing `GOOGLE_BOOKS_API_KEY`. Server logs a one-liner per search but falls back gracefully to Open Library results. Adding the key (free tier 1000 req/day) would unblock the GB second-source cover pass.
5. **Mobile filter overflow at /notes + /quotes** — already fixed in `d6a5a1a`, regression-pinned in `src/routes/notes-filter-overflow.spec.tsx`.

## Files changed in this iteration

| File                       | Change   | Why                                                                                                                                                                                                        |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/add-book.ts`      | NEW      | Pure helper — normDup (with Polish transliteration), cleanIsbn, buildIsbnIndex, buildTitleAuthorIndex, findDuplicate, decideAddAction.                                                                     |
| `src/lib/add-book.spec.ts` | NEW      | 9 unit tests pin the duplicate-guard + override contract.                                                                                                                                                  |
| `src/routes/add-book.tsx`  | MODIFIED | `useIsDuplicateBook` now returns `{isDuplicate, index}` and delegates normalization + decision to the helper. All three `add(force, ...)` handlers (Search, ISBN, Manual) call `decideAddAction` directly. |

## Verification on the VPS

```bash
cd /home/agata/agata-s-cozy-corner
npm install && npm run build
npm test                       # 333/333
npx tsc --noEmit               # 0 errors
npx eslint .                   # 0 problems (auto-fix on the touched files)
DATA_DIR=/var/lib/agata systemctl restart agata
```

The add-book refactor is behaviour-preserving; existing 324 tests still pass + 9 new add-book tests = 333 total.
