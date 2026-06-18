# Architecture

## Overview

Agata is a React app using TanStack Router and local-first state.

The current architecture is intentionally conservative:

- UI routes render from local stores.
- localStorage is the runtime persistence layer.
- Supabase code exists but is gated and must not be used for automatic sync yet.
- Gigi exists as a future feature and remains mock-only.

## Main folders

```text
src/
  components/        Shared UI components.
  integrations/      External service clients such as Supabase.
  lib/               Stores, helpers, search, sync guards, backup logic.
  routes/            TanStack Router file routes.
  routeTree.gen.ts   Generated TanStack Router route tree.
```

## Core local stores

### `src/lib/books-store.ts`

Responsible for:

- base book records,
- locally added books,
- mock/seed book override hiding,
- book creation,
- book update,
- duplicate detection,
- cover compression.

Important exports:

- `getAllBooks()`
- `getEffectiveBookById()`
- `createBook()`
- `updateBook()`
- `deleteBook()`
- `useBooksVersion()`

### `src/lib/book-workspace-store.ts`

Responsible for:

- book user state,
- reading status,
- current page,
- rating,
- favourite state,
- opinion,
- reading sessions,
- note drafts,
- workspace version hook.

Important exports:

- `getAllBookState()`
- `getBookState()`
- `updateBookState()`
- `getStoredSessions()`
- `createReadingSession()`
- `getCombinedSessionsForBook()`
- `useWorkspaceVersion()`

### `src/lib/effective-books.ts`

This is the effective runtime view layer.

It exists because base book data and workspace user state are stored separately. Runtime UI should normally read from this layer.

Important exports:

- `getAllEffectiveBooks()`
- `getEffectiveBookByIdSafe()`
- `useAllEffectiveBooks()`
- `useEffectiveBook()`
- `useEffectiveBooksVersion()`

## Effective book rule

Most UI should use effective books.

Raw books are not enough for UI because user state may live in workspace storage:

- status,
- currentPage,
- rating,
- isFavourite,
- opinion,
- startedAt,
- finishedAt.

If a route displays book state, it should use effective books.

## Notes store

### `src/lib/notes-store.ts`

Responsible for:

- notes,
- quotes,
- chapter notes,
- other notes,
- deletion state,
- version hook.

Runtime note pages should use:

- `getAllNotes()`
- `getNotesForBook()`
- `getNoteById()`
- `useNotesVersion()`

## Stats helper

### `src/lib/stats.ts`

Responsible for derived statistics:

- total reading minutes,
- pages read,
- sessions,
- streak,
- monthly buckets,
- yearly summary.

Stats should use real sessions and effective books.

## External book metadata

### `src/lib/book-search.ts`

Responsible for:

- Google Books title/author search,
- Open Library title/author merge/fallback,
- Open Library ISBN lookup,
- Google Books ISBN fallback/enrichment,
- deduplication,
- Polish ranking.

See `BOOK_SEARCH.md`.

## Backup

### `src/lib/backup.ts`

Responsible for exporting/importing local data.

Backup must cover all local-first data keys. See `LOCAL_FIRST_STORAGE.md`.

## Cloud and Supabase

Cloud code exists, but the app must not auto-sync yet.

Important files:

- `src/lib/supabase-safe.ts`
- `src/lib/cloud-sync.ts`
- `src/lib/auth-context.tsx`
- `src/components/DatabaseStatus.tsx`

See `SUPABASE_AND_SYNC.md`.

## UI shell

### `src/components/AppShell.tsx`

Responsible for:

- top bar,
- sidebar,
- mobile drawer,
- quick actions,
- theme/auth UI entry points.

Quick actions must use route-safe TanStack Router links.

## Route architecture

Routes are file-based in `src/routes`.

Important route groups:

- `/` home dashboard,
- `/library`,
- `/add-book`,
- `/read`,
- `/notes`, `/quotes`, `/chapters`, `/other-notes`,
- `/book/$id/*`,
- `/note/$id`,
- `/settings`,
- `/gigi`.

See `ROUTING.md`.
