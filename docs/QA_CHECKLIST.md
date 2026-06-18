# QA Checklist

Run this checklist after every routing, data, notes, or book-search change.

## 1. App boot

- App opens without login.
- No blank screen.
- No Supabase env crash.
- Home renders.
- Header and drawer work.

## 2. Manual book add

- Open `/add-book`.
- Add a manual book with title and author.
- App saves the book.
- App navigates to `/book/local-...`.
- Book detail page opens.
- Refresh on `/book/local-...`.
- Book still opens after refresh.

## 3. Book search

Test Polish titles:

- `Lalka`
- `Chłopi`
- `Wiedźmin`

Test Polish authors:

- `Olga Tokarczuk`
- `Remigiusz Mróz`
- `Andrzej Sapkowski`

Expected:

- real API results appear,
- no fake book inserted on failure,
- user can save a result,
- saved book opens.

## 4. ISBN lookup

- Enter a valid ISBN.
- Open Library is tried first.
- Google fallback/enrichment works when available.
- Save result.
- Book opens.
- Book appears in Library and Home.

## 5. Library

- `/library` shows local books.
- Search inside library works.
- Filters work:
  - `Wszystkie`,
  - `W kolejce`,
  - `Zaczęte`,
  - `Wstrzymane`,
  - `Odrzucone`,
  - `Przeczytane`,
  - `Ulubione`.
- Local book cards are clickable.
- Clicking opens `/book/$id`.

## 6. Home

Check sections:

- `Moja biblioteka` shows real/effective books.
- `Ulubione` shows books marked favourite.
- `Statystyki` uses real/effective progress and sessions.
- `Polecane` uses real/effective books or empty state.
- `W kolejce` shows queue books.

## 7. Book workspace

For a local book, test:

- `/book/$id`
- `/book/$id/about`
- `/book/$id/status`
- `/book/$id/read`
- `/book/$id/stats`
- `/book/$id/notes`

Expected:

- no `Nie znaleziono książki` for a valid local book,
- no crash on refresh,
- status/favourite/currentPage/rating update everywhere.

## 8. Favourite/status/progress consistency

- Mark book as favourite.
- Confirm Home `Ulubione` updates.
- Confirm Library `Ulubione` filter updates.
- Change status to `Zaczęte`.
- Confirm `/read` opens that book.
- Save a reading session.
- Confirm progress updates on book page, Library, Home, Stats.

## 9. Notes

For a local book:

- Add quote.
- Add normal/other note.
- Add chapter note.
- Open `/notes`.
- Open `/quotes`.
- Open `/chapters`.
- Open `/other-notes`.
- Click note cards.
- Refresh note detail route.

Expected:

- note links open valid routes,
- missing notes show Polish missing state,
- no mock-only editor appears.

## 10. Quick actions

Open mobile/profile drawer and test:

- `Dodaj książkę`
- `Dodaj cytat`
- `Dodaj notatkę`
- `Zdjęcie strony`
- `Sesja czytania`
- `Notes iPad`

Expected:

- no broken route,
- note actions open book picker or real editor flow,
- no query-string-in-`to` route bug.

## 11. Backup/settings

- Open `/settings`.
- Confirm backup/export UI is available.
- Confirm cloud sync remains disabled/gated.
- Confirm no accidental push/pull happens.

## 12. Build checks

Run:

```bash
tsc --noEmit
npm run build
npm run lint
```

If lint fails due to old untouched files, document it. Touched files should be clean.

## 13. Do not proceed if any of these fail

- Adding a book does not open it.
- Local book fails on refresh.
- `/read` cannot find reading book.
- Favourite/status/progress differs between pages.
- Quick action opens broken route.
- Note card opens missing/mocked editor.
- Cloud sync starts running automatically.
