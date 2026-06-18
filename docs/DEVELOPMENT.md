# Development Workflow

This document explains how to work safely in the Agata repository.

## Main rule

Before building new features, keep the current local-first product stable.

Do not skip routing, state, and persistence checks.

## Recommended workflow

1. Read `docs/PROJECT_SOURCE_OF_TRUTH.md`.
2. Read the relevant docs for the area being changed.
3. Make the smallest safe change.
4. Run typecheck/build/lint.
5. Manually test affected routes.
6. Update docs if architecture, routes, storage, or data model changes.

## Commands

Run where applicable:

```bash
npm install
npm run dev
npm run build
npm run lint
tsc --noEmit
```

Some projects may not expose every script. If a command does not exist, report it clearly.

## Branching

For larger changes, prefer a feature branch:

```bash
git checkout -b fix/route-state-consistency
```

For urgent small fixes, committing directly to `main` is acceptable only when the owner requested direct repair.

## Commit style

Use clear commit messages:

- `Fix local book routing`
- `Use effective books in library`
- `Add book search documentation`
- `Gate cloud sync actions`

Avoid vague messages like:

- `update`
- `fix stuff`
- `changes`

## Code safety rules

Do not:

- wipe localStorage,
- enable Supabase sync,
- introduce auth requirement for local app,
- connect Gigi,
- add paid APIs,
- rewrite unrelated UI,
- reformat the whole repo for a tiny bug fix.

## Data safety rules

All user-facing data changes should be reversible where possible.

Before changing persistence shape:

- document the old key,
- document the new key,
- write a safe migration plan,
- keep backup/export in mind,
- do not silently drop fields.

## Documentation update requirement

Update docs when changing:

- routes,
- localStorage keys,
- data models,
- book search APIs,
- Supabase/sync behavior,
- Gigi behavior,
- backup/export format,
- major UI navigation.

## Manual QA requirement

Use `docs/QA_CHECKLIST.md` after every meaningful change.

At minimum test:

- add manual book,
- add searched book,
- open local book,
- refresh local book route,
- favourite/status/progress update,
- add note,
- open note from global page,
- quick actions.

## When to stop

Stop and report before continuing if:

- app fails to boot,
- typecheck fails with unclear root cause,
- local data appears lost,
- route tree is broken,
- a fix requires cloud schema changes,
- a fix could overwrite user data.
