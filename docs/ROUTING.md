# Routing

Agata uses TanStack Router with file routes in `src/routes`.

The generated route tree is in `src/routeTree.gen.ts`.

## Route safety rules

1. Do not pass query strings inside `to`.
2. Use `params` for dynamic path segments.
3. Use `search` for query/search parameters.
4. Do not depend on localStorage inside route loaders that may run before client hydration.
5. Local-first data should be read in components through client-safe stores/hooks.

## Correct examples

Dynamic book page:

```tsx
<Link to="/book/$id" params={{ id: book.id }}>
  Open book
</Link>
```

New note with search params:

```tsx
<Link to="/note/$id" params={{ id: "new" }} search={{ type: "quote" }}>
  Dodaj cytat
</Link>
```

Programmatic navigation:

```ts
router.navigate({
  to: "/book/$id",
  params: { id: book.id },
});
```

## Avoid

```tsx
<Link to="/note/new?type=quote">Dodaj cytat</Link>
```

This is fragile because `/note/new?type=quote` is not a real file route. The real route is `/note/$id` with `id = "new"` and search params.

## Main routes

| Route              | Purpose                          | Notes                                             |
| ------------------ | -------------------------------- | ------------------------------------------------- |
| `/`                | Home dashboard                   | Must use effective books.                         |
| `/library`         | User library                     | Must use effective books.                         |
| `/add-book`        | Add/search/ISBN/manual book flow | Uses real book APIs + manual fallback.            |
| `/search`          | Legacy alias                     | May redirect to `/add-book`.                      |
| `/read`            | Global reading entry             | Finds effective book with `status === "reading"`. |
| `/notes`           | Global notes list                | Uses notes-store.                                 |
| `/quotes`          | Global quote notes               | Uses notes-store.                                 |
| `/chapters`        | Global chapter notes             | Uses notes-store.                                 |
| `/other-notes`     | Global other notes               | Uses notes-store.                                 |
| `/recommendations` | Real-data recommendations        | Must use effective books.                         |
| `/statistics`      | Stats dashboard                  | Must use sessions + effective books.              |
| `/settings`        | Settings/backup/sync status      | Cloud sync must remain gated.                     |
| `/gigi`            | Future assistant UI              | Mock-only until dedicated phase.                  |

## Book routes

| Route                      | Purpose                            |
| -------------------------- | ---------------------------------- |
| `/book/$id`                | Book dashboard/index               |
| `/book/$id/about`          | Book metadata/details              |
| `/book/$id/status`         | Reading status/progress management |
| `/book/$id/read`           | Reading session page               |
| `/book/$id/stats`          | Book-specific stats                |
| `/book/$id/notes`          | Book notes area                    |
| `/book/$id/notes/all`      | All book notes                     |
| `/book/$id/notes/quotes`   | Book quotes                        |
| `/book/$id/notes/chapters` | Book chapter notes                 |
| `/book/$id/notes/other`    | Other notes for book               |
| `/book/$id/notes/new`      | Create note for book               |
| `/book/$id/notes/$noteId`  | Note detail/edit                   |

Book child routes must read the book client-side and show Polish missing state if not found.

Do not put localStorage-dependent lookups in route loaders for these pages.

## Note compatibility route

`/note/$id` exists as a compatibility wrapper.

Expected behavior:

- `/note/new?type=quote` equivalent should be done as `/note/$id` with id `new` and search `{ type: "quote" }`.
- If `id` is an existing note id and the note has `bookId`, redirect to `/book/$bookId/notes/$noteId`.
- If note is missing, show `Nie znaleziono notatki`.
- If no books exist when creating a note, show a link to `/add-book`.

## Current known route risk

The quick action drawer must be checked after every routing change. It has historically been the most likely source of broken links because quick actions used manually composed strings.
