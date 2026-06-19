# Full Audit & Production-Readiness Fixes

Audit znalazł 8 błędów krytycznych, 16 ważnych, 11 drobnych. Naprawiam je w 5 fazach, w tej kolejności (każda faza weryfikowana screenshotami na 393 / 820 / 1440 / 1920 px).

## Faza 1 — Krytyczne bugi funkcjonalne (najpierw, bo „udaje że działa")

1. **`/notebook` to mock** — strona ma hardcodowane „Fourth Wing · Strona 186", tekst „Ten fragment mnie złamał", a przyciski (Pen/Highlighter/Eraser/Save) nie mają `onClick`.
   - Przepinam stronę na realny `HandwritingCanvas` + `NoteEditor` flow z wyborem książki z biblioteki; jeśli nie ma żadnej — empty state z CTA „Dodaj książkę".
   - Usuwam hardcodowane dane osobowe.

2. **`/gigi` to fałszywka** — wysyła `Math.random()` mock odpowiedzi zamiast wołać `/api/chat`.
   - Podpinam realny server function call do `/api/chat` (już istnieje, autoryzowany przez Supabase), z streamingiem, stanami `loading/error`, retry, i `initialGigiMessages` → pusty wątek + system prompt powitalny tylko gdy historia pusta.

3. **`AppShell` dzwonek (Bell)** — przycisk bez `onClick`. Albo dodaję realny popover „Brak nowych powiadomień" (placeholder produkcyjny), albo usuwam całkiem. Wybieram: popover z czystym empty state.

4. **`NoteEditor` autosave gubi `chapterTitle`** — brak w deps `useEffect`. Dodaję.

5. **`NoteEditor` inputMode fallback** — gdy `drawingDataUrl` istnieje a `inputMode` undefined (stare notatki), wymuszamy `handwriting`.

## Faza 2 — Layout / responsywność (flexible, mobile-first od 360 do 1920 px)

6. **AppShell**
   - Mobile drawer: `w-[300px]` → `w-[min(85vw,320px)]`.
   - Mobilny topbar: dodaję `sticky top-0` także poniżej `lg` (teraz znika hamburger po scrollu).
   - `DrawerLink` × 10+ subskrybuje `useRouterState` niezależnie — czytam `pathname` raz w `AppShell` i przekazuję propem.
   - Wrapper main: `max-w-[var(--content-max)]` + responsive `px-4 sm:px-6 lg:px-10` zsynchronizowany z headerem.

7. **`PageHeader`** — usuwam duplikujące się `px-5 lg:px-10` (już są w shell), zostaje tylko spacing pionowy.

8. **`NotesListPage`** sticky preview — `sticky top-6` koliduje z topbarem. Zmieniam na `sticky top-[calc(var(--header-h)+1rem)]` z `--header-h` zdefiniowanym w `styles.css`.

9. **`/gigi`** — `h-[calc(100vh-0px)]` → `h-[100dvh]` (iOS Safari).

10. **`/notebook`** — usuwam custom `bg-[oklch(...)]`, używam tej samej warstwy ambient co reszta.

11. **`NoteEditor`** — `pb-28` + sticky bar dostają `pb-[max(7rem,env(safe-area-inset-bottom))]`.

12. **`/library`** — usuwam `!important` na `BookCover` w gridzie; ujednolicam `aspect-[2/3]` na poziomie `BookCover` + responsywne `gap-3 sm:gap-4 lg:gap-6`.

13. **`/index` BookShelfPreview** — `min-h-*` zastąpione przez `aspect`/intrinsic content, kończymy z pustą przestrzenią na 1920.

14. **Mobile bottom nav** (NEW) — dodaję dolny pasek nawigacji (Home, Library, Notes, Gigi, Settings) widoczny `< md`, żeby telefon miał stałą nawigację bez konieczności scrollowania do topbara. Bezpieczna strefa `pb-safe`.

## Faza 3 — Performance

15. **`HandwritingCanvas`**
    - `ToolButton` hoist out of render (krytyczne — remontowany na każdy pointer-move).
    - `drawAll` z incremental render (rysuję tylko nowy stroke, full redraw tylko na resize/undo/redo).
    - `requestAnimationFrame` throttling dla `onMove`.

16. **`NoteCard`** — `React.memo` + stabilne handlery przez `useCallback` w rodzicu.

17. **`/statistics`, `/index`, `/library`** — `useMemo` na agregatach z localStorage; jedno wspólne `useNotesVersion()` + `useBooksVersion()` jako trigger.

18. **`/library`** — virtualizacja gridu książek przy >50 pozycjach (`@tanstack/react-virtual`, już w stacku, dodam jeśli nie ma).

19. **Obrazki** — `BookCover` dostaje `loading="lazy"`, `decoding="async"`, `sizes` ustawiony pod realny grid.

## Faza 4 — Dane i URL state

20. **`/notes`, `/quotes`** — `window.history.replaceState` → TanStack Router `useNavigate` + `validateSearch` (zod). Naprawia back/forward.

21. **Decyzja Supabase vs localStorage**: zachowuję localStorage jako primary store (off-line first), ale wprowadzam **kontrakt store**: jeden `notesStore` / `booksStore` modul z eventami; każdy hook (`useNotes`, `useBooks`, `useStats`) korzysta z `useSyncExternalStore`. Eliminuje to wielokrotne parsowanie localStorage i niespójności między tabami (BroadcastChannel jako sync).

22. **`/api/chat`** — sprawdzam czy `requireSupabaseAuth` jest podpięty w `start.ts` (`attachSupabaseAuth`) — jeśli nie, dodaję.

## Faza 5 — Production grade: SEO, error boundaries, a11y

23. **`head()` na 14 brakujących trasach** (`book.$id.*`, `note.$id`, `notebook`, `gigi`, `auth`, `read`, `search`): każda dostaje unikalny `title` (z loadera, np. `${book.title} — Notatki | Agata`), `description`, `og:title`, `og:description`. W trasach dynamicznych — z loader data.

24. **`errorComponent` + `notFoundComponent`** na każdej trasie z loaderem oraz na `__root.tsx`. Wspólny `RouteError` i `RouteNotFound` komponent z designem aplikacji, przyciskami „Wróć" / „Strona główna" i `router.invalidate()` na retry. **Nigdy nie pokazujemy `error.message` w produkcji** — tylko przyjazny tekst.

25. **`add-book.tsx` BarcodeDetector** — feature detection + graceful fallback (ukrywam zakładkę „Skanuj" w Safari/Firefox, pokazuję podpowiedź „Wpisz ISBN ręcznie").

26. **`BookCover`** — zamiast hardcodowanej listy tytułów PL, algorytmiczne wykrywanie kontrastu z palety okładki (oklch lightness) → automatyczny kolor tytułu.

27. **A11y** — `aria-label` na wszystkich icon-only buttonach (notebook toolbar, AppShell), focus rings spójne z designem, `prefers-reduced-motion` respect na ambient animations.

28. **Sprzątanie** — usunięcie `console.log`, `mock-data.ts` rozdzielone na `src/lib/types.ts` (typy) i kasacja `initialGigiMessages`.

## Sekcja techniczna (developer detail)

- **Router context**: dodam `getHeaderHeight` jako CSS var `--header-h` mierzony przez `ResizeObserver` w `AppShell`, używany w sticky offsetach.
- **Store refactor**: `src/lib/stores/notes.ts` + `useSyncExternalStore` + `BroadcastChannel('agata-notes')` dla multi-tab sync.
- **Search params**: zod schema per route (`notes`, `quotes`, `library`), `useNavigate({ search: prev => ({...prev, q}) })`.
- **SEO head**: helper `buildHead({ title, description, image? })` w `src/lib/seo.ts`.
- **Error boundary**: `src/components/RouteError.tsx`, `src/components/RouteNotFound.tsx` użyte we wszystkich `createFileRoute`.
- **Bundle**: lazy import `HandwritingCanvas` w `NoteEditor` (`React.lazy`) — duży komponent ładowany tylko gdy `mode === 'handwriting'`.
- **Weryfikacja**: po każdej fazie screenshoty 393 / 820 / 1440 / 1920 dla kluczowych stron (`/`, `/library`, `/notes`, `/gigi`, `/notebook`, `/book/:id`, `/note/:id`), test interakcji (zapis notatki, rysowanie, wysłanie wiadomości Gigi), check console (0 errors) i network.

## Czego NIE zmieniam

- Designu wizualnego (palety, fontów) — chyba że konkretny token jest zepsuty.
- Architektury route'ów (nazwy plików).
- Auth flow.

Czas i zakres: ~28 osobnych edycji w ~25 plikach. Czy zaczynam od Fazy 1?
