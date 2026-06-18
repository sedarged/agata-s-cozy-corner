# Known Issues and Risks

This file tracks known risks that must not be forgotten.

## Current high-priority issues

### 1. Quick action routing still needs final verification

The app historically used links like:

```text
/note/new?type=quote
```

The safe route is:

```tsx
to="/note/$id"
params={{ id: "new" }}
search={{ type: "quote" }}
```

This must be manually verified in `AppShell.tsx` and the mobile/profile drawer.

### 2. Effective book state must remain consistent

The app has separate base book records and workspace state.

Risk:

- Book detail shows favourite/status/progress,
- Library/Home/Read/Stats show stale values.

Mitigation:

- UI should use effective books.
- Workspace state should mirror to book store where safe.
- Test after favourite/status/progress changes.

### 3. Supabase sync is not safe yet

Do not enable cloud sync until:

- real user RLS is verified,
- owner gate is verified,
- local ids are safely mapped to cloud UUIDs,
- photo/handwriting storage is designed,
- backup is verified.

### 4. Gigi is mock-only

Gigi is not connected to OpenAI, ChatGPT, or any real model.

Do not build Gigi until:

- local-first flows are stable,
- notes/books/read sessions are reliable,
- cloud decision is clear.

### 5. Book search data quality varies

Google Books and Open Library may miss:

- Polish descriptions,
- page count,
- covers,
- exact edition,
- publisher data.

Manual add must remain available.

### 6. Large local media can hit storage quota

Risks:

- cover images,
- page photos,
- handwriting/drawing data URLs.

If quota fails, show Polish error and do not pretend save succeeded.

### 7. Route loaders must not depend on localStorage

Previous bug:

- `/book/$id` loader read localStorage before client hydration,
- local books returned missing,
- valid local book routes showed not found.

Rule:

- local-first lookups should happen client-side in components.

### 8. `mock-data.ts` must not be deleted yet

It is still used as seed/demo data and for mock-only Gigi content.

Do not remove it until a separate seed-data replacement is designed.

## Not safe yet

- automatic cloud sync,
- deleting mock-data entirely,
- enforcing auth for local use,
- real Gigi/OpenAI integration,
- paid API integration,
- destructive data migrations.

## Safe current work

- route fixes,
- link fixes,
- effective book consistency,
- notes route consistency,
- local backup verification,
- Polish UI polish,
- accessibility fixes.
