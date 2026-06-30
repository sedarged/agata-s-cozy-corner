-- Add book-linking columns to `chat_sessions` and `chat_messages`.
-- Lets a Gigi conversation be tied to a specific book — Agata opens "Ask
-- Gigi about this book" from a book detail page, the new chat is created
-- with `book_id` set, and every message fan-out under it carries the
-- same `book_id` so later analytics / "open previous chats from this
-- book" UIs can query it without a join through app-side state.
--
-- `book_id` is NULLable on both tables:
--   - chat_sessions: existing chats have no book context; only new
--     book-linked chats set the column.
--   - chat_messages: same — pre-existing messages keep NULL, new ones
--     inherit from the parent session.
--
-- FK references books(id) ON DELETE SET NULL: if a book is deleted, the
-- chat history is preserved (Agata may want to keep the conversation)
-- but the link becomes NULL so the UI can hide "open chat" affordances
-- for dangling references.
ALTER TABLE `chat_sessions` ADD COLUMN `book_id` text REFERENCES books(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD COLUMN `book_id` text REFERENCES books(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `chat_sessions_book_id_idx` ON `chat_sessions` (`book_id`);