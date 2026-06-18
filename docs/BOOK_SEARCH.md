# Book Search

Agata uses real external book metadata for search and ISBN lookup.

The implementation lives in:

```text
src/lib/book-search.ts
src/routes/add-book.tsx
src/lib/books-store.ts
```

## API decision

### Title / author search

Primary:

- Google Books Volumes API

Secondary / merge / fallback:

- Open Library Search API

Reason:

- Google Books is usually stronger for modern and popular Polish editions, covers, descriptions, publishers, and page counts.
- Open Library remains useful as an open bibliographic source and extra metadata source.

### ISBN lookup

Primary:

- Open Library ISBN endpoint

Secondary / fallback / enrichment:

- Google Books `isbn:<isbn>` query

## API endpoints

Google Books title/author:

```text
https://www.googleapis.com/books/v1/volumes?q=<query>&maxResults=15
```

Google Books Polish-first search may use:

```text
langRestrict=pl
```

Open Library title/author:

```text
https://openlibrary.org/search.json?q=<query>&limit=15
```

Open Library ISBN:

```text
https://openlibrary.org/isbn/<isbn>.json
```

Google Books ISBN fallback:

```text
https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn>
```

## Rules

Do not add unless explicitly approved:

- paid APIs,
- Amazon Product Advertising API,
- Goodreads API,
- ISBNdb,
- secret frontend API keys.

Manual add must always work offline.

## Search behavior

Title/author search should:

1. query Google Books first,
2. query Open Library and merge results,
3. deduplicate,
4. rank Polish/complete results higher,
5. allow saving real results into the local book store.

ISBN lookup should:

1. normalize ISBN input,
2. query Open Library ISBN endpoint first,
3. enrich/fallback using Google Books,
4. create a local book only after user confirms/saves.

## Deduplication

Preferred dedupe key:

1. ISBN where available,
2. normalized title + author when ISBN is missing.

Normalization should ignore:

- punctuation,
- casing,
- repeated whitespace,
- diacritics where useful.

## Ranking signals

Boost results with:

- `language === "pl"`,
- Polish-looking publisher/metadata,
- exact title match,
- author match,
- ISBN present,
- cover present,
- pageCount present,
- description present,
- publisher present,
- publishedDate present.

Do not hide non-Polish results completely. Rank Polish/complete results higher.

## Mapping to app book model

| External field | App field |
|---|---|
| title | `title` |
| authors / author_name | `author` |
| isbn | `isbn` |
| cover | `cover_url` |
| description | `description` |
| page count | `pageCount` |
| published date/year | `publishedDate` |
| publisher | `publisher` if supported |
| category/subject | `genre` |
| provider | `source` |
| provider id/key | `external_id` or provider-specific field when added |

## Source values

Use correct source values:

- `google` for Google Books search results,
- `openlibrary` for Open Library search results,
- `isbn` for ISBN tab results,
- `manual` for manual entry,
- `scan` for future scan flow.

## Polish fallback labels

Use these labels in UI:

- `Brak autora`,
- `Brak tytułu`,
- `Brak opisu`,
- `Brak danych`,
- `Szukam książki…`,
- `Nie znaleziono książek`,
- `Nie znaleziono książki dla tego ISBN.`,
- `Nie udało się pobrać danych. Możesz dodać książkę ręcznie.`

## Failure behavior

If APIs fail:

- do not create fake books,
- do not insert mock results,
- show a Polish error/empty state,
- keep manual add available.
