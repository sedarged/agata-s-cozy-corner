# AI Working Rules

These rules apply to Lovable, Codex, Claude, ChatGPT, and any automated coding agent working in this repository.

## First rule

Read the documentation before editing code:

1. `docs/PROJECT_SOURCE_OF_TRUTH.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DATA_MODEL.md`
4. `docs/ROUTING.md`
5. `docs/LOCAL_FIRST_STORAGE.md`
6. `docs/KNOWN_ISSUES.md`

## Current protected areas

Do not touch these unless the task explicitly says so:

- Gigi real integration,
- OpenAI integration,
- automatic Supabase sync,
- destructive data migration,
- full redesign,
- auth enforcement,
- paid API integration.

## Required behavior for fixes

When fixing bugs:

- identify the exact source file,
- identify the route or store affected,
- fix the smallest safe area,
- keep local-first behavior intact,
- preserve Polish UI labels,
- preserve existing visual design,
- do not wipe localStorage,
- do not convert local data to cloud data automatically.

## Required checks after changes

Run or report:

- `tsc --noEmit`,
- `npm run build`,
- `npm run lint` if available.

If lint has old unrelated debt, do not reformat the whole repo. Touched files must be clean.

## Route/link rules

Use TanStack Router safely:

- do not put query strings directly inside `to`,
- use `params` for dynamic route parameters,
- use `search` for query parameters,
- do not link to route strings that are not in `routeTree.gen.ts`,
- do not rely on localStorage inside route loaders that can run before client hydration.

Correct example:

```tsx
<Link to="/note/$id" params={{ id: "new" }} search={{ type: "quote" }}>
  Dodaj cytat
</Link>
```

Avoid:

```tsx
<Link to="/note/new?type=quote">Dodaj cytat</Link>
```

## Data source rules

Runtime UI must use effective book data, not raw mock data.

Prefer:

- `getAllEffectiveBooks()`
- `getEffectiveBookByIdSafe()`
- `useAllEffectiveBooks()`
- `useEffectiveBook()`

Raw `getAllBooks()` is allowed only when the caller intentionally wants base store data. Most UI pages should use effective books.

## Mock data rule

`mock-data.ts` may remain as seed/demo/fallback data.

Do not use direct mock imports in runtime routes unless:

- it is type-only,
- it is explicitly a seed/demo path,
- it is the isolated Gigi mock page.

## Cloud safety rule

Supabase is not the source of truth yet.

Cloud sync must remain disabled until:

- RLS is verified with a real user,
- owner gate is verified,
- media/handwriting storage plan is completed,
- backup/restore is tested,
- manual QA passes.

## Final response required from agents

Every agent change must report:

1. files changed,
2. bugs fixed,
3. routes affected,
4. data stores affected,
5. build/typecheck/lint result,
6. anything still unsafe.
