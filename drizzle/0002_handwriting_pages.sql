CREATE TABLE `handwriting_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`page_index` integer NOT NULL,
	`data_url` text NOT NULL,
	`background` text DEFAULT 'plain' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handwriting_pages_note_id_idx` ON `handwriting_pages` (`note_id`);--> statement-breakpoint
CREATE INDEX `handwriting_pages_note_id_index_idx` ON `handwriting_pages` (`note_id`,`page_index`);
