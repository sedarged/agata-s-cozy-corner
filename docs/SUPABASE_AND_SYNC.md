# Supabase and Sync

Supabase support exists in the codebase, but cloud sync is not currently enabled as a trusted runtime feature.

## Current decision

Agata remains local-first.

Do not enable:

- automatic push,
- automatic pull,
- automatic migration,
- destructive cloud overwrite,
- required login,
- Gigi cloud memory.

## Current cloud status

Cloud is gated and treated as unsafe until verified.

Known requirements before enabling sync:

1. Supabase project must be configured.
2. Real user login must be tested.
3. RLS must be verified with a normal authenticated user, not only service/admin role.
4. Owner gate must be verified.
5. Local-id to cloud-UUID mapping must be implemented safely.
6. Notes with page photos/handwriting must have a storage/schema plan.
7. Backup/export must be tested before any migration.
8. Manual QA must pass.

## Important files

```text
src/lib/supabase-safe.ts
src/lib/cloud-sync.ts
src/lib/auth-context.tsx
src/components/DatabaseStatus.tsx
src/routes/auth.tsx
src/routes/settings.tsx
```

## Safe Supabase client rule

Supabase must be lazy and safe.

The app must not crash when Supabase env vars are missing.

Expected behavior:

- app opens normally,
- local-first data works,
- auth controls can be disabled or show safe message,
- cloud sync panel reports unavailable/gated state.

## RLS warning

Admin/service-role checks are not proof that normal user RLS works.

Before sync is enabled, verify with:

- real logged-in user,
- normal client session,
- insert/select/update/delete restrictions,
- cross-user access blocked,
- owner user id gate.

## Local ids vs cloud ids

Local book ids are not UUIDs.

Example:

```text
local-<timestamp>-<random>
```

Cloud database `id` columns may be UUIDs. Never write local ids into UUID columns.

Future mapping should use:

- cloud UUID for database rows,
- `external_id` or mapping table for local ids,
- provider ids for Google/Open Library references.

## Media and handwriting risk

Local notes may contain:

- photo data URLs,
- handwriting drawing data URLs,
- local-only media fields.

Do not push these to Supabase until:

- storage bucket is verified,
- upload path strategy exists,
- schema has storage references,
- backup covers media fields,
- quota/size behavior is understood.

## What sync must never do

Sync must never:

- wipe local data without backup,
- silently replace local data,
- push unsupported media and lose it,
- merge different users' data,
- use service-role logic in the frontend,
- require login for local use.

## Future safe sync sequence

1. Verify schema locally/in Supabase.
2. Verify RLS with real user.
3. Verify owner gate.
4. Add read-only cloud diagnostics.
5. Add dry-run compare local vs cloud.
6. Add manual export backup reminder.
7. Add explicit manual push.
8. Add explicit manual pull.
9. Only then consider automatic sync.

## Current user-facing wording

Use Polish warnings such as:

- `Synchronizacja z chmurą jest jeszcze wyłączona.`
- `Tryb lokalny jest bezpieczny i aktywny.`
- `RLS użytkownika nie został jeszcze zweryfikowany.`
- `Owner gate nie został jeszcze zweryfikowany.`
