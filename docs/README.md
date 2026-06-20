# Agata — Documentation Index

This folder is the source of truth for the Agata reading app.

Agata is a private reading, library, notes, quotes, and reading-session app for Agata, hosted
long-term on the owner's VPS.

> **Start with [`../CLAUDE.md`](../CLAUDE.md)** for the live working state, the active roadmap, and
> build/verify commands. The project is **exiting Lovable** and moving to a self-hosted
> server-authoritative SQLite setup — see [`exit-lovable-plan.md`](./exit-lovable-plan.md) and
> [`local-database-plan.md`](./local-database-plan.md). Some documents below predate that move and
> are being updated; where they conflict, `CLAUDE.md` and the two plan docs win.

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
16. [`exit-lovable-plan.md`](./exit-lovable-plan.md) — **active** plan to leave Lovable + ChatGPT-OAuth research.
17. [`local-database-plan.md`](./local-database-plan.md) — **active** plan for the VPS SQLite datastore.
18. [`ENVIRONMENT.md`](./ENVIRONMENT.md) — environment variables (current + planned).

## Current high-level status (2026-06-20)

- App data: **localStorage today**, moving to **server-authoritative SQLite on the VPS** (roadmap).
- Real book search: **enabled, server-side** via `/api/book-search` — Google Books + Open Library
  **+ Biblioteka Narodowa**. (BN mapping pending live verification.)
- Manual book add: **enabled**. Demo/seed data: **removed** (real data only).
- Notes, reading sessions, settings (incl. tag manager / defaults): **enabled**.
- Supabase: **being removed** in favour of SQLite.
- Gigi assistant: **wired to `/api/chat`** but gated behind hidden auth; chat works only once
  connected to ChatGPT (planned OAuth).
- Lovable coupling: **being removed** (dead code already gone; Vite wrapper + AI gateway next).

## Non-negotiable rule

Do not build new features until route integrity, data source consistency, and local-first behavior are verified after every change.
