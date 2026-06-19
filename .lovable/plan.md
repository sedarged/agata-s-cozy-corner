## Pełny fix: flow dodawania, nawigacja, hydration, responsywność, performance

### 1. Flow „Dodaj książkę” — zapis dopiero po wzbogaceniu danych
- `src/routes/add-book.tsx`
  - Z karty wyniku (`ResultCard`) usunąć bezpośredni zapis. Zostaje akcja „Szczegóły” jako główny przycisk + drugi „Dodaj” otwierający modal szczegółów (nie zapisujący).
  - Faktyczny `createBook` wywoływany dopiero z `BookDetailsModal` po `enrichBookDetails`, na pełnym `data`, nie surowym `r`.
  - `IsbnResultCard`: `onAdd(data)` przekazuje wzbogacone `BookSearchResult` do `IsbnTab.add(data)`. Zapis używa `data.source` (`google`/`openlibrary`) zamiast hardkodowanego `"isbn"`. Ścieżka ISBN nadal pozostaje rozpoznawalna po polu, ale realne źródło danych nie jest tracone.
  - `dup` w modalu liczony po `loading === false`, żeby nie mrugał.
  - „Dodaj mimo to” używa aktualnych, wzbogaconych danych, nie starego `r`.
  - `router.navigate(...)` po zapisie awaitowany; usunięty nieosiągalny toast.
  - `onClose` w `ResultCard`/`IsbnResultCard` przez `useCallback`, żeby modal nie re-mountował efektów.
  - `ScanTab → IsbnTab`: zamiast `CustomEvent` na `window`, prefill ISBN przez state w `AddBook` przekazany propsem.

### 2. Lepsze błędy API + częściowe wyniki
- `src/lib/book-search.ts`
  - `searchBooks` rzuca/zwraca strukturę `{ results, partial, errors }`; UI w `SearchTab` rozróżnia: brak wyników vs problem z pobraniem (np. `429` Google, fail OL).
  - Pokazujemy co się udało pobrać + jeden subtelny komunikat informacyjny. „Nie znaleziono książek” tylko gdy obie ścieżki zwróciły 0 bez błędu.
  - `enrichBookDetails`: dodatkowy fallback dla Open Library, gdy `external_id` nie zaczyna się od `/works/` ale jest `isbn` — wzbogacenie przez Google Books po ISBN.

### 3. Powrót ze szczegółów książki — bez skoku/flasha
- `src/routes/book.$id.index.tsx`
  - `goBack`: zamiast `window.history.length > 1 ? router.history.back() : navigate /library`, użyć bezpiecznego wzorca: jeżeli `document.referrer` jest z tej samej origin i poprzedni wpis to znana trasa aplikacji — `router.history.back()`; w przeciwnym razie `router.navigate({ to: "/library" })`.
  - Dodać scroll restore: zawsze `window.scrollTo({ top: 0 })` po wejściu (TanStack ma `scrollRestoration`, ale dla nowo dodanej książki history nie ma poprzedniego scroll-state — fallback do top).
- Spójność back buttonów we wszystkich podstronach (`book.$id.about|read|stats|status|notes/*`): trzymają obecne „wróć do dashboardu książki”, co już działa.

### 4. Hydration mismatch lokalnych książek (Home + Library)
- Źródło problemu: `getAllEffectiveBooks()`/`getAllBooks()` czyta `localStorage` synchronicznie podczas SSR (zwraca pusto), a po hydratacji już zawiera lokalne książki. Wynika z tego mismatch `href="/book/1"` ↔ `href="/book/local-…"`.
- Fix:
  - W `src/routes/index.tsx` (sekcje półki/ulubione/queue) i w `src/routes/library.tsx` użyć `useSyncExternalStore`-owego `useBooksVersion`/`useEffectiveBooksVersion` z `getServerSnapshot` → pusta lista. Renderowanie listy książek opóźnić do po `useEffect`-flag `mounted` (klient), żeby pierwszy render klienta był identyczny ze SSR. Wyświetlać szkielet (skeleton) z tej samej geometrii, więc wizualnie zero skoku.
  - Półka „Moja biblioteka” na SSR: pokaż 6 placeholderów o tych samych rozmiarach jak `BookCover lg`, żeby layout nie podskakiwał po hydratacji.
- `src/components/BookCover.tsx`
  - `onError` powoduje swap obrazka → fallback z innym DOM-em → flash. Zmiana: trzymać tę samą strukturę kontenera (rozmiar/ramki/cienie), wyłączać tylko `<img>` przy błędzie i pokazywać fallback wewnątrz tego samego wrappera, żeby nie przebudowywać layoutu. Dodać `decoding="async"` i `fetchpriority="low"` dla małych okładek.

### 5. Responsywność i pozycjonowanie — bez redesignu
- `src/routes/add-book.tsx`
  - Search input + przycisk: na 360–414px input zajmuje całą szerokość, a „Szukaj książki” skraca się do ikony + krótkiego labelu „Szukaj”, bez zawijania w 2 linie. Layout: `grid-cols-[minmax(0,1fr)_auto]` na mobile, `flex` od `sm`.
  - Taby: kontener `overflow-x-auto`, każdy tab `shrink-0`, padding spójny; na 320–360px wszystkie 4 taby osiągalne bez ucinania.
  - Modal szczegółów (`BookDetailsModal`): na mobile bottom-sheet `max-h-[92vh]`, sticky header i sticky footer (już są), ale wewnątrz wymusić `min-h-0` + `overflow-y-auto` na środku, żeby footer „Dodaj do biblioteki” był zawsze widoczny.
- `src/routes/book.$id.index.tsx`
  - Wiersz nagłówka (back/title/heart) zmienić na `grid grid-cols-[auto_minmax(0,1fr)_auto]` z `truncate` na tytule.
  - Akcje (4 kafle) — utrzymać `grid-cols-2`, ale `min-w-0` + `truncate` na labelach.
- `src/components/AppShell.tsx`
  - Topbar — logo centralnie absolute potrafi nachodzić na ikony przy 320px; dodać `pointer-events-none` na wrapper logo i ograniczyć max-width, ikony zostają klikalne.

### 6. Płynność przejść + performance
- Globalny `ScrollToTopOnRouteChange` w `__root.tsx`: nasłuch zmian `useRouterState({ select: s => s.location.pathname })` i `window.scrollTo({ top: 0, behavior: 'instant' })` przed paintem nowej trasy → koniec „skoków”.
- W `AppShell` `useEffect` zamykający drawer już istnieje — zostaje.
- `BookDetailsModal`:
  - `enrichBookDetails` przerywalny przez `AbortController` (timeout w `fetchWithTimeout` już jest, ale dodać anulowanie po odmontowaniu).
  - Memoizacja `dup` po `data.isbn|title|author`.
- `src/lib/book-search.ts`
  - Krótszy timeout dla równoległych zapytań (np. 6s) + krótki retry tylko dla `429/5xx`.
  - Cache 10min już jest — zostaje.
- `BookCover`: `loading="lazy"` zostaje, dodać `decoding="async"`.

### 7. Weryfikacja po wdrożeniu
- Manualne flow w preview (mobile 390x844, tablet 820x1180, desktop 1366x768):
  1. `/add-book` → szukanie → karta → „Szczegóły” → enrichment → „Dodaj do biblioteki” → ląduję na `/book/$id` z pełnymi danymi i `source` zgodnym ze źródłem.
  2. ISBN → szczegóły → dodaj — dane wzbogacone trafiają do biblioteki.
  3. Home + Library → brak hydration warning, brak flasha okładek, lokalne książki klikają się od pierwszego renderu.
  4. `/book/$id` → „Wróć” wraca przewidywalnie do `/library` lub poprzedniej trasy; brak skoku/flasha.
  5. `/read` znajduje aktualnie czytaną książkę.
- Komendy: `npm run build`, `npm run lint`, `tsc --noEmit` — muszą przejść.

### Czego NIE ruszam
- Redesignu, Supabase sync, Gigi, OpenAI, localStorage, integracji zewnętrznych poza Google Books + Open Library.