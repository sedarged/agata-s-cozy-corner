CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_sha256_unique` ON `assets` (`sha256`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`isbn` text DEFAULT '' NOT NULL,
	`cover_url` text,
	`cover_gradient` text DEFAULT 'from-amber-100 to-rose-200' NOT NULL,
	`cover_accent` text DEFAULT '#a16207' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`current_page` integer DEFAULT 0 NOT NULL,
	`published_date` text DEFAULT '' NOT NULL,
	`genre` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'queue' NOT NULL,
	`rating` integer,
	`is_favourite` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`publisher` text,
	`language` text,
	`series_name` text,
	`series_part` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`opinion` text,
	`started_at` text,
	`finished_at` text,
	`added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`yearly_books` integer DEFAULT 24 NOT NULL,
	`weekly_minutes` integer DEFAULT 210 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`content` text DEFAULT '' NOT NULL,
	`quote_text` text,
	`comment` text,
	`page_number` integer,
	`chapter_number` integer,
	`chapter_title` text,
	`photo_url` text,
	`input_mode` text,
	`drawing_data_url` text,
	`drawing_background` text,
	`is_favourite` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_book_id_idx` ON `notes` (`book_id`);--> statement-breakpoint
CREATE TABLE `notes_deleted` (
	`id` text PRIMARY KEY NOT NULL,
	`deleted_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`date` text NOT NULL,
	`minutes` integer DEFAULT 0 NOT NULL,
	`pages_read` integer DEFAULT 0 NOT NULL,
	`start_page` integer DEFAULT 0 NOT NULL,
	`end_page` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reading_sessions_book_id_idx` ON `reading_sessions` (`book_id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_date_idx` ON `reading_sessions` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
