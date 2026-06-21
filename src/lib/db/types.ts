// Typed row shapes exported for consumers (server fns + repos). These are the
// shapes returned by repository helpers, matching the camelCase fields in
// src/lib/db/schema.ts.
import type { schema } from "./client";

export type BookRow = typeof schema.books.$inferSelect;
export type BookInsert = typeof schema.books.$inferInsert;
export type NoteRow = typeof schema.notes.$inferSelect;
export type NoteInsert = typeof schema.notes.$inferInsert;
export type ReadingSessionRow = typeof schema.readingSessions.$inferSelect;
export type ReadingSessionInsert = typeof schema.readingSessions.$inferInsert;
export type GoalRow = typeof schema.goals.$inferSelect;
export type SettingRow = typeof schema.settings.$inferSelect;
export type AssetRow = typeof schema.assets.$inferSelect;
