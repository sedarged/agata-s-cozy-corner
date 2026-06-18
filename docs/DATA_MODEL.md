# Data Model

## Book

The app book model is based on the existing `Book` type from `src/lib/mock-data.ts`, extended by locally added metadata where needed.

Core fields:

```ts
interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  cover_url?: string | null;
  coverGradient: string;
  coverAccent: string;
  description: string;
  pageCount: number;
  currentPage: number;
  publishedDate: string;
  genre: string;
  status: BookStatus;
  rating?: number;
  isFavourite: boolean;
  tags: string[];
}
```

Locally added/search-added books may also carry:

```ts
publisher?: string;
language?: string;
seriesName?: string;
seriesPart?: string;
source?: "manual" | "openlibrary" | "google" | "isbn" | "scan";
addedAt?: string;
updatedAt?: string;
opinion?: string;
startedAt?: string;
finishedAt?: string;
```

## BookStatus

Canonical values:

```ts
type BookStatus = "reading" | "queue" | "finished" | "paused" | "dropped";
```

Polish UI labels:

| Status | UI label |
|---|---|
| `reading` | `Zaczęte` |
| `queue` | `W kolejce` |
| `finished` | `Przeczytane` |
| `paused` | `Wstrzymane` |
| `dropped` | `Odrzucone` |

## EffectiveBook

Runtime UI should normally use the effective book view model.

Effective book = base book + workspace state.

Workspace fields that override/extend base book:

- `status`,
- `currentPage`,
- `rating`,
- `isFavourite`,
- `opinion`,
- `startedAt`,
- `finishedAt`.

Use:

- `getAllEffectiveBooks()`
- `getEffectiveBookByIdSafe()`
- `useAllEffectiveBooks()`
- `useEffectiveBook()`

## BookUserState

Stored in `agata-book-state-v1`.

```ts
interface BookUserState {
  bookId: string;
  status?: string;
  currentPage?: number;
  rating?: number;
  favourite?: boolean;
  opinion?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
}
```

This exists so user-specific reading state can be separated from the base book record.

## Reading session

Stored in `agata-reading-sessions-v1`.

```ts
interface StoredReadingSession {
  id: string;
  bookId: string;
  date: string;
  minutes: number;
  pagesRead: number;
  startPage: number;
  endPage: number;
  createdAt: string;
  updatedAt: string;
}
```

Rules:

- `bookId` must point to a valid book id.
- `pagesRead` should never be negative.
- `endPage` should not be lower than `startPage`.
- saving a session may update `currentPage` and status.

## Note

Notes are stored through `src/lib/notes-store.ts`.

Current app note types:

- `quote`,
- `note`,
- `page-photo`,
- `chapter`,
- `other`.

Supabase/database note types may be different and require mapping:

| App note type | Cloud/db note type |
|---|---|
| `quote` | `quote` |
| `note` | `text` |
| `page-photo` | `photo` |
| `chapter` | `chapter` |
| `other` | `other` |
| cloud `summary` | app `other` unless app gains summary support |

## Note ownership

Every runtime note should normally belong to a book via `bookId`.

Global `/note/$id` is a compatibility wrapper:

- if `id === "new"`, choose a book first,
- if an existing note has `bookId`, redirect to `/book/$bookId/notes/$noteId`,
- if note is missing, show Polish missing state.

## Source field

Book source should describe how the book entered the app:

- `manual` — user typed manually,
- `google` — Google Books result,
- `openlibrary` — Open Library result,
- `isbn` — ISBN lookup result,
- `scan` — barcode/scan flow if implemented later.

Do not save Google search results as `isbn` unless they came from the ISBN tab/fallback.

## IDs

Local books use ids similar to:

```text
local-<timestamp>-<random>
```

Do not assume local ids are UUIDs.

Future Supabase sync must map local ids to cloud UUIDs via an external id mapping strategy. Never write local ids into UUID database columns.
