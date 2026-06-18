# Changelog

This changelog records human-readable product and architecture changes.

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
