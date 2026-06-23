// Agata — the merged "Book + user workspace state" shape that consumers
// (book.$id, library, home) read from. Originally this file also exported
// React hooks that merged localStorage state into the server-shaped book;
// those were removed once the home/library migration to React Query
// (Phase 1.5) made the workspace-merge no longer needed at the client
// boundary. Keep the type here because many components still annotate
// `EffectiveBook[]` in their props.
import type { Book } from "./mock-data";

export type EffectiveBook = Book & {
  publisher?: string;
  language?: string;
  seriesName?: string;
  seriesPart?: string;
  source?: string;
  addedAt?: string;
  updatedAt?: string;
  opinion?: string;
  startedAt?: string;
  finishedAt?: string;
};
