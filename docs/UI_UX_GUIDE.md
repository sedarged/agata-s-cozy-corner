# UI / UX Guide

Agata should feel like a private, elegant, cozy reading space.

The app is not meant to look like a generic admin dashboard.

## Visual direction

Preferred feel:

- warm,
- calm,
- premium,
- bookish,
- journal-like,
- private,
- polished.

Core visual language:

- cream / warm background,
- glass cards,
- champagne/gold accents,
- soft shadows,
- rounded panels,
- elegant serif headings,
- script Agata logo,
- book-cover focused layouts.

## Language

Primary UI language: Polish.

Avoid raw English fallbacks in user-facing UI.

Good labels:

- `Moja biblioteka`
- `Ulubione`
- `Statystyki`
- `Polecane`
- `W kolejce`
- `Dodaj książkę`
- `Dodaj cytat`
- `Dodaj notatkę`
- `Zaczęte`
- `Przeczytane`
- `Brak danych`
- `Nie znaleziono książki`

## Home order

Home section order should remain:

1. `Moja biblioteka`
2. `Ulubione`
3. `Statystyki`
4. `Polecane`
5. `W kolejce`

Do not reorder without explicit product decision.

## Header rules

Current header direction:

- centered `Agata` script logo,
- profile/menu icon on the left,
- notification/theme controls on the right,
- no clutter.

## Empty states

Empty states must be useful and Polish.

Examples:

- `Brak książek w tej sekcji`
- `Dodaj pierwszą książkę`
- `Dodaj i oceń kilka książek, żeby zobaczyć lepsze polecenia.`
- `Nie masz jeszcze żadnej książki w bibliotece.`

Do not fill empty states with fake user data.

## Accessibility rules

For touched UI:

- icon-only buttons need `aria-label`,
- decorative icons need `aria-hidden="true"`,
- interactive elements must be keyboard reachable,
- visible focus styles should remain,
- forms need labels or aria-labels,
- avoid click-only divs.

## Book cards

Book cards should:

- use actual `book.id`,
- link to `/book/$id`,
- show title and author,
- show favourite/status/progress where relevant,
- never be disabled if the book is real.

## Notes UI

Notes should always make it clear what book they belong to.

Global note pages should still allow users to open the book-specific note route.

## Error UI

Use calm Polish error states.

Examples:

- `Nie znaleziono książki`
- `Nie znaleziono notatki`
- `Nie udało się zapisać zmian.`
- `Brak miejsca na zapisanie danych na tym urządzeniu.`

Do not show raw stack traces or technical JSON errors in normal UI.

## What not to do during bug fixes

- Do not redesign whole pages while fixing routing/state.
- Do not introduce new visual systems.
- Do not remove existing Agata styling.
- Do not change labels randomly.
- Do not make the app feel like a generic CRUD dashboard.
