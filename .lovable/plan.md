## Diagnoza — dlaczego treść „ucieka w lewo"

Po przeszukaniu wszystkich tras znalazłem konkretną przyczynę. `AppShell` ma sidebar (240 px) i `<main className="flex-1">` — bez żadnego centralnego kontenera. Każda strona sama ustawia szerokość, i robi to niespójnie:

```text
home               max-w-[1120px] mx-auto   ← wyśrodkowane
statistics         max-w-6xl  (BEZ mx-auto) ← przyklejone do lewej
settings           max-w-5xl  (BEZ mx-auto) ← przyklejone do lewej
chapters           max-w-5xl  (BEZ mx-auto) ← przyklejone do lewej
year-in-review     max-w-4xl  (BEZ mx-auto) ← przyklejone do lewej
quotes             max-w-4xl  (BEZ mx-auto) ← przyklejone do lewej
themes / reco /    max-w-3xl  (BEZ mx-auto) ← przyklejone do lewej
add-book / other
library            max-w-md   (BEZ mx-auto) ← przyklejone do lewej
notes list /       brak max-w               ← full-bleed do prawej krawędzi
note editor /
book.* (większość)
```

Na monitorze 1440–1920 px sidebar zajmuje 240 px, a treść 768 px (`max-w-3xl`) zostaje wciśnięta tuż przy sidebar — po prawej zostaje 400–900 px pustego tła. Stąd wrażenie „za bardzo na lewo".

Drugi problem: pasek górny (topbar) jest renderowany pełną szerokością `<main>`, więc rozciąga się wizualnie szerzej niż zawartość strony pod nim. Brak osi optycznej.

## Plan naprawy

### 1. Jeden globalny kontener w AppShell

Wprowadzam token `--content-max: 1200px` i wrapper w `AppShell`:

```tsx
// w <main>:
<header>
  <div className="mx-auto w-full max-w-[var(--content-max)]">
    <div className="agata-topbar …">…</div>
  </div>
</header>
<div className="mx-auto w-full max-w-[var(--content-max)] px-4 sm:px-6 lg:px-10">
  {children}
</div>
```

Topbar i treść zaczynają i kończą się na tej samej osi.

### 2. Usuwam duplikujące się `max-w-*` z każdej trasy

Z każdej zewnętrznej `<div>` strony usuwam `max-w-3xl/4xl/5xl/6xl/[1120px]` i jeśli były własne `mx-auto` / `px-*` na poziomie strony — zostaje to po stronie wrappera. Wewnętrzne sekcje (modale, dymki czatu, karty centralne) zostają z `max-w-*` bez zmian.

Routy do edycji: `index`, `library`, `themes`, `chapters`, `quotes`, `recommendations`, `statistics`, `year-in-review`, `settings`, `add-book`, `other-notes`, `note.$id`, `gigi`, `book.$id.index`, `book.$id.about`, `book.$id.notes.*`, `book.$id.read`, `book.$id.stats`, `book.$id.status`, `notes`, `notebook`, `NoteEditor`, `NotesListPage`.

### 3. Wąskie strony — opt-in

Strony formularzowe (np. `add-book`, `settings`, dłuższe artykuły jak `year-in-review`) wewnątrz globalnego kontenera otrzymują własne `max-w-3xl mx-auto` / `max-w-4xl mx-auto` na pojedynczych sekcjach, tak żeby tekst nie miał 1100 px długości linii.

### 4. Audyt responsywny (oprócz centrowania)

**Web ≥ 1280:** Sidebar 240 + kontener 1200 + marginesy = wszystko zmieści się do 1920 bez sprawiania, że treść siedzi pod sidebarem.

**iPad portrait (810 px):** sidebar pojawia się dopiero przy `lg:` (1024). Sprawdzam i poprawiam tam, gdzie potrzeba:
- `grid sm:grid-cols-2` w `themes`, `chapters`, `quotes`, `book.$id.about` → dodaję `md:` breakpoint dla iPada, żeby karty nie były rozjechane,
- `NoteEditor` tab bar: na iPad pokażę więcej zakładek równocześnie.

**iPhone 16 (393 × 852):** sprawdzam czy nigdzie nie ma poziomego scrolla — `overflow-x-clip` jest w `AppShell` (jest), ale weryfikuję każdą stronę z pełnoekranowymi gridami i sticky paskami akcji. Punkty kontrolne:
- `NoteEditor` sticky action bar — OK po ostatnich zmianach,
- `BookShelfPreview` / paski na home — sprawdzam czy nie wystają,
- `add-book` modal — czy `max-w-2xl` nie powoduje overflow w wąskim viewportcie (mam `w-full` + `sm:max-w-2xl`, OK).

### 5. Weryfikacja

Po zmianach robię screenshoty 4 widoków (1440 desktop, 1024 iPad landscape, 810 iPad portrait, 393 iPhone) dla 6 reprezentatywnych tras: `/` , `/library`, `/notes`, `/book/:id`, `/book/:id/notes/new`, `/settings`. Jeśli coś jeszcze „ucieka", poprawiam punktowo.

## Szczegóły techniczne

- Wartość `--content-max: 1200px` jest celowa: home używał 1120, statistics 1152, więc 1200 mieści wszystkie istniejące layouty bez ścieśniania.
- Zmiana NIE zmienia żadnego designu pojedynczych sekcji — tylko ich umiejscowienie poziome i spójność z paskiem górnym.
- Nie ruszam komponentów modali, dymków czatu (`gigi`), wewnętrznych kart — tylko zewnętrzne wrappery strony.
- Tabele i sticky paski akcji w `NoteEditor` zostają jak są — tylko trafiają do wyśrodkowanego kontenera.

## Co dostarczam

1. Edycja `AppShell.tsx` — wrapper kontenera + topbar w tym samym wrapperze.
2. Edycja `src/styles.css` — token `--content-max`.
3. Edycja ~20 plików tras + 2 komponentów (`NoteEditor`, `NotesListPage`) — usunięcie zewnętrznych `max-w-*` / `px-* lg:px-10` tam gdzie zostały zduplikowane, pozostawienie wewnętrznych ograniczeń tekstu.
4. Drobne poprawki responsywne na iPad portrait dla siatek 2-kolumnowych.
5. Screenshot-verify czterech viewportów na końcu.
