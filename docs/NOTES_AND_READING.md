# Notes and Reading

This document explains notes, quotes, chapter notes, and reading sessions.

## Notes purpose

Notes are private reading records attached to books.

Supported app note categories:

- quotes,
- normal notes,
- page photos,
- chapter notes,
- other notes.

Every normal runtime note should belong to a book.

## Notes store

Main file:

```text
src/lib/notes-store.ts
```

Important functions:

- `getAllNotes()`
- `getNotesForBook(bookId)`
- `getNoteById(noteId)`
- `createNote()`
- `updateNote()`
- `deleteNote()`
- `useNotesVersion()`

## Global notes routes

| Route          | Purpose        |
| -------------- | -------------- |
| `/notes`       | All notes.     |
| `/quotes`      | Quote notes.   |
| `/chapters`    | Chapter notes. |
| `/other-notes` | Other notes.   |

Global routes should use notes-store and effective books for book labels/covers.

## Book-specific note routes

| Route                      | Purpose                     |
| -------------------------- | --------------------------- |
| `/book/$id/notes`          | Book note dashboard.        |
| `/book/$id/notes/all`      | All notes for one book.     |
| `/book/$id/notes/quotes`   | Quotes for one book.        |
| `/book/$id/notes/chapters` | Chapter notes for one book. |
| `/book/$id/notes/other`    | Other notes for one book.   |
| `/book/$id/notes/new`      | Create a note for one book. |
| `/book/$id/notes/$noteId`  | View/edit one note.         |

## Global note compatibility route

`/note/$id` is a compatibility wrapper.

Rules:

- `id === "new"` opens a book picker.
- Existing notes redirect to `/book/$bookId/notes/$noteId`.
- Missing notes show `Nie znaleziono notatki`.
- If there are no books, show a link to `/add-book`.

## Quick action note creation

Quick actions must route safely:

```tsx
<Link to="/note/$id" params={{ id: "new" }} search={{ type: "quote" }} />
```

Do not use query strings embedded in `to`.

## Note type mapping

| UI action      | App note type                                    |
| -------------- | ------------------------------------------------ |
| Dodaj cytat    | `quote`                                          |
| Dodaj notatkę  | `note` or `other` depending editor support       |
| Zdjęcie strony | `page-photo` or `other` depending editor support |
| Rozdział       | `chapter`                                        |
| Inne           | `other`                                          |

For cloud/db mapping see `DATA_MODEL.md`.

## Reading sessions

Reading sessions are stored in:

```text
agata-reading-sessions-v1
```

Main file:

```text
src/lib/book-workspace-store.ts
```

Important functions:

- `getStoredSessions()`
- `getSessionsForBook(bookId)`
- `createReadingSession()`
- `updateReadingSession()`
- `deleteReadingSession()`
- `getCombinedSessionsForBook(bookId)`

## Reading session save behavior

When a session is saved:

- create a `StoredReadingSession`,
- update `currentPage` if the session moved forward,
- if the book was `queue`, change it to `reading`,
- update UI everywhere through effective book state.

## `/read` route

`/read` is a global reading shortcut.

Expected behavior:

- find the first effective book with `status === "reading"`,
- redirect to `/book/$id/read`,
- if none exists, show Polish empty state with a link to `/library`.

## Data consistency warning

The app historically had two sources of book state:

- base book records in `books-store`,
- workspace user state in `book-workspace-store`.

All UI must read effective books so favourite/status/progress/rating do not drift between pages.

## Manual QA for notes and reading

After changes, test:

1. Add a local book.
2. Open book page.
3. Add a quote.
4. Confirm it appears in `/quotes`.
5. Add a chapter note.
6. Confirm it appears in `/chapters`.
7. Add an other note.
8. Confirm it appears in `/other-notes`.
9. Open each note card.
10. Refresh on note route.
11. Start a reading session.
12. Save session.
13. Confirm `/read`, Home, Library, and Stats update.
