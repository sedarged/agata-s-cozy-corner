# Agata — Documentation Index

This folder is the source of truth for the Agata reading app.

Agata is a private, local-first reading, library, notes, quotes, and reading-session app for Agata. The app is currently designed to work safely without login, without cloud sync, and without Gigi/OpenAI integration enabled.

## Read first

1. [`PROJECT_SOURCE_OF_TRUTH.md`](./PROJECT_SOURCE_OF_TRUTH.md) — product purpose, current state, strict rules, safe next steps.
2. [`AI_WORKING_RULES.md`](./AI_WORKING_RULES.md) — rules for Lovable, Codex, Claude, ChatGPT, or any coding agent touching this repo.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — app structure, routes, stores, and data flow.
4. [`DATA_MODEL.md`](./DATA_MODEL.md) — book, note, reading session, rating, and user-state model.
5. [`ROUTING.md`](./ROUTING.md) — TanStack Router route map and link rules.
6. [`LOCAL_FIRST_STORAGE.md`](./LOCAL_FIRST_STORAGE.md) — localStorage keys and offline-first safety.
7. [`BOOK_SEARCH.md`](./BOOK_SEARCH.md) — Google Books, Open Library, ISBN lookup, ranking, mapping.
8. [`NOTES_AND_READING.md`](./NOTES_AND_READING.md) — notes, quotes, chapter notes, reading sessions.
9. [`SUPABASE_AND_SYNC.md`](./SUPABASE_AND_SYNC.md) — current cloud status and future safe sync gate.
10. [`UI_UX_GUIDE.md`](./UI_UX_GUIDE.md) — visual rules, Polish labels, accessibility.
11. [`QA_CHECKLIST.md`](./QA_CHECKLIST.md) — manual test matrix.
12. [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) — current risks and things not yet safe.
13. [`SECURITY_AND_PRIVACY.md`](./SECURITY_AND_PRIVACY.md) — privacy, secrets, local data, cloud safety.
14. [`DEVELOPMENT.md`](./DEVELOPMENT.md) — development workflow and safe change process.
15. [`CHANGELOG.md`](./CHANGELOG.md) — human-readable project changes.

## Current high-level status

- Local-first app: **enabled**.
- Real book search: **enabled** using Google Books and Open Library.
- Manual book add: **enabled**.
- Notes and reading sessions: **local-first**.
- Supabase cloud sync: **gated / disabled**.
- Gigi assistant: **mock-only / not connected**.
- OpenAI integration: **not implemented**.

## Non-negotiable rule

Do not build new features until route integrity, data source consistency, and local-first behavior are verified after every change.
