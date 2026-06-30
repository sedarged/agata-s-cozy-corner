-- Agata — §9 review cache + provider source registry.
--
-- review_cache stores per-(book, source) provider responses with a
-- fetched_at timestamp so the social-proof fetcher can replay a row
-- when BOOK_PROVIDER_CACHE_TTL_DAYS hasn't elapsed. The payload is a
-- JSON blob matching BookSocialProofDTO; we keep the raw structure in
-- TEXT so future provider-shape changes don't require a migration.
--
-- provider_sources records which providers are configured (env-gated
-- at boot). The UI uses this to surface "NYT: niedostępne — brak klucza
-- API" instead of silently 404'ing in the cache layer.

CREATE TABLE `review_cache` (
	`book_id` text NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `source`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_cache_book_id_idx` ON `review_cache` (`book_id`);
--> statement-breakpoint
CREATE TABLE `provider_sources` (
	`source` text PRIMARY KEY NOT NULL,
	`configured` integer NOT NULL DEFAULT 0,
	`last_checked_at` text
);
