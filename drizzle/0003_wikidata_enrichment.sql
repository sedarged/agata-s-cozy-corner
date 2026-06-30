-- Add Wikidata enrichment columns to `books`.
-- - `wikidata_id`: the Q-number (e.g. "Q104226") of the matching Wikidata item.
-- - `wikidata_description`: Wikidata's short blurb for that item, kept distinct
--   from the existing `description` column (which is the user-editable blurb).
-- - `enriched_at`: ISO timestamp of the last successful enrichment. NULL means
--   the book has never been enriched.
--
-- All three columns are nullable. The enrichment path is opt-in via
-- WIKIDATA_ENRICHMENT_ENABLED=true and never blocks create/update — see
-- `src/lib/wikidata-enrichment.server.ts`.
ALTER TABLE `books` ADD COLUMN `wikidata_id` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `wikidata_description` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `enriched_at` text;
