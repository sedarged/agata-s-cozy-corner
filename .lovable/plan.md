
# Wzbogacenie info o książkach z Google Books + Open Library

Audit pokazał, że nasz `src/lib/book-search.ts` korzysta tylko z ~30% pól, które oferują oba API. Modal szczegółów książki w `add-book.tsx` jest przez to ubogi. Plan: wyciągnąć resztę przydatnych danych i pokazać je w UI — bez nowych API, bez kluczy, bez zmian w `books-store` ani w schemie zapisu.

## Co dodajemy do `BookSearchResult`

| Pole | Z Google Books | Z Open Library |
|---|---|---|
| `subtitle` | `volumeInfo.subtitle` | `search.subtitle` |
| `authors[]` (pełna lista) | `volumeInfo.authors` | `author_name` |
| `isbn10` / `isbn13` (oba osobno) | `industryIdentifiers` filtr po typie | — |
| `rating` + `ratings_count` | `averageRating`, `ratingsCount` | `ratings_average`, `ratings_count` |
| `edition_count` | — | `edition_count` |
| `first_sentence` | — | `first_sentence` (search + works/{id}.json) |
| `subjects[]` (top 8) | `categories` | `subject` |
| `preview_url` | `previewLink` | — |
| `info_url` | `infoLink` / `canonicalVolumeLink` | `https://openlibrary.org{key}` |
| `buy_url` | `saleInfo.buyLink` | — |
| `read_online_url` | `accessInfo.webReaderLink` (gdy `viewability=ALL_PAGES`) | `https://archive.org/details/{ia}` gdy `ebook_access ∈ {public, borrowable}` |
| `maturity_rating` | `volumeInfo.maturityRating` | — |
| HD `cover_url` | `imageLinks.extraLarge → large → medium → thumbnail` z podmianą `zoom=2` | `cover_i` lub fallback `cover_edition_key` |

## Zmiany w `src/lib/book-search.ts`

1. **Rozszerz interfejsy** `BookSearchResult`, `OLDoc`, `GBVolume` o pola powyżej (`saleInfo`, `accessInfo`, `previewLink`, `averageRating`, `subtitle`, `ratings_average`, `edition_count`, `first_sentence`, `ia`, `ebook_access`, `cover_edition_key`).
2. **Helpery**:
   - `bestGoogleCover(info)` — wybiera największą wersję okładki; fallback przez `upscaleGoogleCover()` zamieniający `&zoom=1` → `&zoom=2` i usuwający `&edge=curl`.
   - `pickIsbns(industryIdentifiers)` — preferuje ISBN_13, oddzielnie wystawia `isbn10`/`isbn13`.
   - `mapGoogleVolume(v)` — pojedynczy mapper używany w search i enrichment (eliminuje duplikację).
3. **`searchOpenLibrary`**:
   - Dodaj parametr `&fields=key,title,subtitle,author_name,isbn,cover_i,cover_edition_key,first_publish_year,number_of_pages_median,subject,publisher,language,ratings_average,ratings_count,edition_count,first_sentence,ia,ebook_access` (~10× mniejszy payload).
   - Dodaj `&language=pol` gdy query zawiera polskie diakrytyki (`/[ąćęłńóśźż]/i`).
   - Mapuj nowe pola, generuj `read_online_url` z `ia` + `ebook_access`, `info_url` z `key`.
4. **`searchGoogleBooks`**: dodaj `&printType=books` (filtruje magazyny). Reszta przez `mapGoogleVolume`.
5. **`mergeResults(a, b)`** — wspólna funkcja do merge'owania metadanych, używana w `searchBooks`, `lookupByIsbn`, `enrichBookDetails`. OL wiedzie, Google enrichuje brakujące pola (i odwrotnie).
6. **`scoreResult`** — bonus za `rating` i za `ratings_count > 50` (lepsze wyniki dla popularnych).
7. **`lookupByIsbn`**:
   - Pobieraj do 3 autorów (zamiast 1).
   - Zapisuj `external_id` jako `works.key` jeśli OL zwróci `works`, żeby `enrichBookDetails` działał później.
   - Fallback covera: `https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false`.
   - Po merge z Google dodaj `preview_url`, `buy_url`, `rating`, HD cover.
8. **`enrichBookDetails`**:
   - Dla Google: pełny `mapGoogleVolume(v)` (zamiast ręcznego cherry-pick) → automatycznie wciąga rating, preview, buy, HD cover, subtitle.
   - Dla OL `/works/{id}.json`: dodaj `first_sentence`, `subjects[]`. Następnie jeśli mamy `r.isbn` — dociągnij Google Books `isbn:` i zmerguj (rating + preview + HD cover dla wyników OL).
9. **In-memory cache** (Map z TTL 10 min) dla `searchBooks`, `lookupByIsbn`, `enrichBookDetails` — eliminuje duplikat fetchy gdy user otwiera/zamyka modal lub powtarza query.
10. **`sourceUrl`** — preferuj `r.info_url` jeśli ustawione (Google `infoLink` jest dokładniejsze niż konstruowany URL).

## Zmiany w `src/routes/add-book.tsx` — modal szczegółów

W `BookDetailsModal`:

1. **Tytuł** — pod `<h2>` dodaj `data.subtitle` jako szary kursywą.
2. **Autorzy** — gdy `data.authors?.length > 1`, pokaż listę (przecinkami) zamiast tylko `data.author`.
3. **Ocena** — gdy `data.rating`, pokaż wiersz w `dl`:
   ```
   Ocena: ★ 4.2 (1 234 ocen)
   ```
   (komponent inline z gwiazdką z lucide `Star`).
4. **Liczba wydań** — gdy `data.edition_count`, dodaj wiersz "Wydania: 42".
5. **ISBN** — pokaż osobno ISBN_13 i ISBN_10 jeśli oba dostępne (font-mono, każdy w osobnym wierszu).
6. **Pierwsze zdanie** — nowa sekcja nad opisem (jeśli `data.first_sentence`):
   ```
   PIERWSZE ZDANIE
   "Wszystkie szczęśliwe rodziny są do siebie podobne…"
   ```
   stylowane jako cytat z italic + lewy border w `--accent-gold`.
7. **Tematy / kategorie** — gdy `data.subjects?.length`, render jako poziome chips poniżej `dl` (max 8, z `flex-wrap gap-1.5`).
8. **Linki akcji** (nad/obok "Zobacz źródło"):
   - `data.preview_url` → "📖 Podgląd Google Books" (target=_blank)
   - `data.read_online_url` → "🌐 Czytaj online (Archive.org)"
   - `data.buy_url` → "🛒 Kup na Google Books"
   Każdy jako pill z `glass` + `ExternalLink` icon.
9. **Kategoria wiekowa** — `maturity_rating === "MATURE"` → mały badge "18+" w nagłówku.
10. **Loader UX**: enrichment teraz zawsze włącza spinner (też gdy `description` już jest — bo dociągamy rating/preview/HD cover dla OL).

## Zmiany w `ResultCard` (lista wyników)

1. Pokaż `subtitle` jako drugi wiersz w jasnoszarym (jeśli istnieje, line-clamp-1).
2. Gdy `r.rating`, dodaj mały badge "★ 4.2" obok PL/source labels.
3. Użyj nowej HD okładki (już ze zmiany w `bestGoogleCover`) — bez zmian w komponencie, tylko dane będą lepsze.

## Co NIE zmieniam

- `books-store.ts` / `mock-data.ts` schemat `Book` — nowe pola żyją tylko w wyniku wyszukiwania i modal; do localStorage trafia tak jak teraz (`CreateBookInput`).
- `add-book.tsx` struktura tabów, ISBN flow, manual flow.
- Cloud sync, Gigi, Supabase — bez zmian.
- Żadnych nowych zależności npm.

## Walidacja po implementacji

1. `tsc --noEmit` — 0 błędów.
2. `vite build` — OK.
3. Manualnie w preview:
   - Wyszukaj "Stulecie chirurgów" → sprawdź czy w karcie wynik ma HD cover + ★ rating + PL flag.
   - Otwórz Szczegóły → sprawdź subtitle, pierwsze zdanie, tematy chips, preview link.
   - Wyszukaj ISBN `9788381911320` → karta + modal powinny mieć rating z Google (dociągany w enrichment), opis z OL.
   - Otwórz wynik OL (np. klasyk PD) → sprawdź `read_online_url` → archive.org.

## Szacunek

- `src/lib/book-search.ts` — przepisanie (~+180 linii vs obecne 330).
- `src/routes/add-book.tsx` — `BookDetailsModal` rośnie o ~70 linii (rating row, first_sentence section, subjects chips, action links), `ResultCard` ~+10 linii (subtitle + rating badge).
- Brak nowych plików, brak migracji.

Jeśli plan OK — przełącz na build mode i implementuję od razu.
