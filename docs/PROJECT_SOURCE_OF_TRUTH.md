# Agata — Project Source of Truth

## Product purpose

Agata is a private reading companion app. It is not a public social network, marketplace, or subscription product.

The app should help one private user:

- keep a personal book library,
- add real books from search, ISBN, or manual entry,
- save notes, quotes, chapter notes, page photos, and reading thoughts,
- track reading sessions and progress,
- view simple statistics,
- later receive private recommendations from Gigi.

## Current product direction

The app must behave like a real local-first product, not a static mockup.

Runtime UI must be driven by real user data:

- locally added books,
- search/ISBN-added books,
- local notes,
- local reading sessions,
- local favourite/status/progress/rating state.

Mock data may exist only as seed/demo fallback and for the isolated Gigi mock phase.

## Current technical state

- Framework: React with TanStack Router.
- Styling: Tailwind/shadcn-style components and custom Agata visual styling.
- Data mode: local-first using localStorage.
- Book search: Google Books + Open Library.
- Cloud: Supabase code exists but sync is gated and not active.
- Auth UI: currently controlled by feature flags and should not be forced on.
- Gigi: mock-only and not connected to any real model/API.

## Strict current rules

Do not:

- enable automatic Supabase sync,
- push local data to Supabase,
- pull cloud data into localStorage,
- connect Gigi,
- implement OpenAI integration,
- remove localStorage,
- delete user data,
- remove mock-data entirely,
- redesign the app while fixing data/routing bugs,
- introduce paid book APIs without explicit approval.

## Current priority order

1. Fix routing and broken links.
2. Fix local-first data consistency.
3. Verify book add/search/ISBN flows.
4. Verify notes and reading sessions.
5. Verify backup/export/import.
6. Only then verify Supabase RLS and owner gate.
7. Only after safe cloud architecture, consider controlled sync.
8. Gigi comes later.

## Definition of done for the current phase

The app is acceptable only when:

- a locally added book can be opened immediately,
- a searched/ISBN book can be opened immediately,
- Library and Home show the same effective state,
- favourite/status/progress/rating updates are visible everywhere,
- `/read` opens the currently reading book,
- all note links open valid routes,
- quick actions route safely,
- browser refresh does not break local books,
- cloud sync remains disabled,
- typecheck and build pass.

## Safe next milestone

After the above is verified, the next safe milestone is:

**Book Detail / Reading / Notes Flow Polish Pass**

This means improving the existing real flows, not adding Gigi or cloud sync yet.
