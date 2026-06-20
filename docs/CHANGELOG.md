# Changelog

This changelog records human-readable product and architecture changes.

## 2026-06-20 — Real data, search hardening, settings, and the Lovable exit

Branch `claude/todo-implementation-p07a5z` (PR #2).

- **Bug fixes:** `/book/$id` error boundary now uses the safe `ErrorScreen` (no raw `error.message`);
  fixed the dark-mode theme flicker (apply-effect clobbering the pre-paint class); added the
  notifications bell empty-state popover.
- **Removed demo data:** emptied the seed arrays in `src/lib/mock-data.ts` (now types + helpers
  only). The app shows only the user's real data.
- **Settings completed:** implemented the four previously "coming soon" sections — default book
  status, default note style, tag manager (rename/delete across books+notes), and About — backed
  by new `src/lib/preferences.ts`.
- **Book search → real, reliable, multi-catalog:** moved search server-side behind
  `/api/book-search` (`src/lib/book-search.server.ts`) so it is immune to ad-blockers/CSP/CORS;
  added **Biblioteka Narodowa (data.bn.org.pl)** alongside Google Books + Open Library; improved
  covers (`?default=false` + ISBN backfill). NOTE: BN field mapping not yet verified against the live API.
- **Gigi wired to the real `/api/chat`** with streaming + graceful states (replacing canned
  replies). Remains gated behind hidden auth (`SHOW_AUTH_UI = false`) for the private app.
- **Lovable exit started:** removed dead Lovable modules (`src/integrations/lovable/`,
  `src/lib/lovable-error-reporting.ts`, dep `@lovable.dev/cloud-auth-js`). Full plan in
  `docs/exit-lovable-plan.md`; datastore plan in `docs/local-database-plan.md`. Tracked as GitHub
  issues (Exit Lovable & self-host epic).

## 2026-06-18 — Documentation foundation

Added `docs/` folder with source-of-truth documentation:

- project source of truth,
- AI working rules,
- architecture,
- data model,
- routing,
- local-first storage,
- book search,
- notes and reading,
- Supabase/sync safety,
- UI/UX guide,
- QA checklist,
- known issues,
- development workflow.

Purpose:

- stop repeated context loss,
- give Lovable/Codex/Claude/ChatGPT a reliable repo reference,
- make future fixes safer.

## 2026-06-18 — Local book routing repair

Fixed issue where locally added books could not open after creation or refresh because `/book/$id` used a localStorage-dependent loader.

Change:

- parent `/book/$id` route no longer blocks local books before client hydration,
- child routes use client-side lookup/guards.

## 2026-06-18 — Real data mode and Polish book search

Moved app away from runtime mock-driven behavior.

Book search decision:

- Google Books primary for title/author search,
- Open Library merge/fallback for title/author,
- Open Library primary for ISBN,
- Google Books fallback/enrichment for ISBN.

Mock data is seed/demo only.

## 2026-06-18 — Effective book state repairs

Added an effective book view model so UI can combine:

- base book data,
- local book data,
- workspace user state.

Important goal:

- Library/Home/Read/Stats/Book pages must agree on favourite, status, current page, rating, and progress.

## 2026-06-18 — Supabase safety gate

Supabase client and cloud-sync logic were gated.

Current state:

- app works logged out,
- missing Supabase config should not crash app,
- push/pull remains disabled,
- RLS/owner gate still needs real verification.

## 2026-06-18 — Current next work

Finish and verify:

- AppShell quick action route safety,
- recommendations using effective books everywhere,
- statistics page using effective books everywhere,
- source value for Google search results,
- full build/typecheck/lint.

Do not proceed to Gigi or automatic cloud sync yet.
