# Local-First Storage

Agata is currently a local-first app.

The browser localStorage data is the runtime source of truth. Cloud sync is not enabled yet.

## Storage keys

| Key                           | Owner file                | Purpose                                                   |
| ----------------------------- | ------------------------- | --------------------------------------------------------- |
| `agata-books-v1`              | `books-store.ts`          | Local books, overrides, deleted seed ids.                 |
| `agata-book-state-v1`         | `book-workspace-store.ts` | Status, progress, favourite, rating, opinion, timestamps. |
| `agata-reading-sessions-v1`   | `book-workspace-store.ts` | Reading session records.                                  |
| `agata-book-notes-v1`         | `notes-store.ts`          | Notes, quotes, chapter notes, other notes.                |
| `agata-book-notes-deleted-v1` | `notes-store.ts`          | Deleted-note state.                                       |
| `agata-note-draft-<bookId>`   | `book-workspace-store.ts` | Per-book note drafts.                                     |
| `agata-handwriting-prefs-v1`  | backup/settings layer     | Handwriting/drawing preferences.                          |

Other keys may exist for theme, goals, auth cache, or future settings. Backup must include all app-owned local keys.

## Local-first rules

- App must work while logged out.
- App must work without Supabase configured.
- App must not wipe localStorage during sign out.
- App must not auto-migrate data to cloud.
- App must not auto-pull cloud data over local data.
- App must not delete user data during UI fixes.

## Book storage shape

`agata-books-v1` should contain:

```ts
interface StoredShape {
  localBooks: Book[];
  overrides: Record<string, Partial<Book>>;
  deletedIds: string[];
}
```

- `localBooks`: books added by user/search/ISBN/manual.
- `overrides`: modifications to seed/mock books or local books.
- `deletedIds`: ids hidden/deleted from seed/mock books.

## Workspace state

`agata-book-state-v1` stores per-book reading state.

This is separate from the base book record. UI must merge it into the effective book model.

## Effective books

Use effective books for runtime UI.

Effective book data is currently exposed by:

- `getAllEffectiveBooks()`
- `getEffectiveBookByIdSafe()`
- `useAllEffectiveBooks()`
- `useEffectiveBook()`

## Backup/restore requirements

A backup must include at least:

- books,
- book state,
- notes,
- deleted notes,
- reading sessions,
- note drafts,
- goals,
- handwriting preferences,
- theme/settings where used.

Restore must not silently destroy existing data without confirmation.

## Quota handling

When localStorage quota is exceeded:

- show a Polish user-facing error,
- do not pretend save succeeded,
- keep user on the current page,
- offer a safe fallback where possible.

Known high-quota risks:

- large cover images,
- page photos,
- handwriting/drawing data URLs.

## SSR/hydration warning

Do not use localStorage-dependent functions inside route loaders that can execute before client hydration.

Bad pattern:

```ts
loader: ({ params }) => {
  const book = getEffectiveBookById(params.id);
  if (!book) throw notFound();
};
```

Safe pattern:

```tsx
function BookPage() {
  const { id } = Route.useParams();
  const book = useEffectiveBook(id);
  if (!book) return <BookNotFound />;
  return <BookView book={book} />;
}
```
