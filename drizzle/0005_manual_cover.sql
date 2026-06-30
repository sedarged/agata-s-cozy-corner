-- Manual cover override storage. Separate from `cover_url` so an upsert
-- that legitimately wipes the API-derived `cover_url` (e.g. ISBN lookup
-- re-running without a cover result, or a backup import replacing the
-- row) cannot silently clobber the user's manually uploaded cover.
--
-- Render priority (see BookCover.tsx):
--   1. manual_cover_url (user override — wins)
--   2. cover_url (API/cache)
--   3. cover_gradient placeholder
--
-- ON behaviour:
--   - `setManualCover(id, url)` writes here. `upsertBook` ignores it.
--   - `clearManualCover(id)` sets NULL — user explicitly restored API cover.
--   - `ON DELETE CASCADE` from books keeps the storage tidy.
ALTER TABLE `books` ADD COLUMN `manual_cover_url` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `manual_cover_set_at` text;