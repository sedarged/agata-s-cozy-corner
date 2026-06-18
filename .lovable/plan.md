## Cel
W menu "Dodaj książkę" oprócz przycisku **Dodaj do biblioteki** dodać możliwość podejrzenia **pełnych szczegółów** każdego wyniku z Google Books / Open Library, plus przegląd połączeń API, responsywności i wydajności między stronami.

## Zakres zmian

### 1. Karta wyniku wyszukiwania (`SearchTab` + `IsbnTab` w `src/routes/add-book.tsx`)
- Dodać drugi przycisk **"Szczegóły"** obok "Dodaj do biblioteki".
- Klik otwiera modal `BookDetailsModal` (nowy komponent, lokalny w pliku) z:
  - dużą okładką (lub fallback),
  - tytuł, autor, wydawca, rok, język, liczba stron, kategoria, ISBN,
  - pełny opis (z `r.description`, scrollowalny),
  - źródło danych (Open Library / Google Books) + link do strony źródłowej,
  - akcje: **Dodaj do biblioteki**, **Zamknij**, ostrzeżenie o duplikacie jeśli `isDuplicateBook`.
- Modal: glass panel, responsywny (mobile fullscreen sheet, desktop centered, max-w-2xl), trap focus na ESC, scroll-lock body, `role="dialog" aria-modal`.

### 2. Wzbogacenie danych dla detali
W `src/lib/book-search.ts`:
- `searchBooks` obecnie nie zwraca `description` dla wyników Open Library (z search.json) i często brakuje pełnego opisu z Google Books (jest, ale ucięty). Dodać **lazy enrichment** function `enrichBookDetails(r)`:
  - jeśli `r.source === "openlibrary"` i `external_id` zaczyna od `/works/` → pobrać `https://openlibrary.org{external_id}.json` po opis/subjects,
  - jeśli `r.source === "google"` → pobrać `https://www.googleapis.com/books/v1/volumes/{id}` po pełne `description`.
- Wywoływane na żądanie po otwarciu modalu (loader spinner w modalu).

### 3. Lista wyników – polish
- Karta `ResultCard`: dodać małą ikonkę źródła (OL / GB) i flagę języka jeśli `language === "pl"`.
- Wiersz akcji: `Szczegóły` (secondary, glass) + `Dodaj do biblioteki` (gold). Mobile (<sm): przyciski w pełnej szerokości, stack.

### 4. QA — Połączenia API
- Dodać prosty `withTimeout(fetch, 8000)` wrapper w `book-search.ts`, by Google/OL nie wieszały UI (obecnie czysty `fetch` bez timeoutu).
- W obu tabach po stronie UI obsłużyć stan offline (`!navigator.onLine`) — pokazać czytelny komunikat zamiast generic error.

### 5. QA — Responsywność i performance (sprawdzenie + drobne fixy)
- Verify `/add-book`, `/library`, `/book/$id`, `/notes`, `/quotes`, `/recommendations`, `/index` przy 375px (iPhone SE) i 1024px:
  - przyciski tab scrollują (już jest `overflow-x-auto`),
  - cards nie overflow,
  - okładki `loading="lazy"` (dodać gdzie brak),
  - modal nie blokuje scroll na desktopie poza body.
- Sprawdzić nawigację: dodanie książki → `/book/$id` → cofnięcie → lista nadal aktualna (`useBooksVersion`). Naprawić jeśli stale.

### 6. Bez zmian
- Brak nowych zależności.
- Brak cloud sync / Gigi.
- Brak zmian schematu danych (description/publisher/language już są w `CreateBookInput`).
- Brak zmian w designie globalnym.

## Pliki do edycji
- `src/routes/add-book.tsx` — modal szczegółów, druga akcja na karcie, ISBN-tab szczegóły, lazy enrichment hook.
- `src/lib/book-search.ts` — `enrichBookDetails`, `withTimeout`, drobne odporności.
- (opcjonalnie) `src/components/PageHeader.tsx` — jeśli potrzebny w modalu (raczej nie).

## Walidacja
- Typecheck (`tsc --noEmit`) = 0 błędów.
- Manualnie: wyszukać po polsku ("Lalka Prus"), kliknąć Szczegóły → modal z opisem, dodać → redirect do `/book/$id`. Test ISBN 9788373191723 → Szczegóły → modal, dodać.
- Test 375px viewport (iPhone SE): modal fullscreen sheet, brak horyzontalnego scrolla.
- Test offline: wyłączyć sieć → komunikat "Brak połączenia z internetem".

## Akceptacja
- Wyniki Google Books + Open Library mają przycisk **Szczegóły** otwierający modal z pełnym opisem.
- Po obejrzeniu detali można dodać książkę lub zamknąć modal.
- Wszystko działa na mobile (375px) i desktop.
- Brak regresji w nawigacji po dodaniu książki.
- Build/typecheck pass.