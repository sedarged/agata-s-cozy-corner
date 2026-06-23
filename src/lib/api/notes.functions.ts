// Agata — server functions for the `notes` resource. Zod-validated.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as notesRepo from "@/lib/db/repositories/notes";
import { NoteInputSchema, NotePatchSchema } from "@/lib/api/schemas";

export const listNotes = createServerFn({ method: "POST" }).handler(async () => {
  return notesRepo.listNotes();
});

export const listNotesForBook = createServerFn({ method: "POST" })
  .validator(z.object({ bookId: z.string() }))
  .handler(async ({ data }) => notesRepo.listNotesForBook(data.bookId));

export const getNote = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => notesRepo.getNote(data.id));

export const createNote = createServerFn({ method: "POST" })
  .validator(NoteInputSchema)
  .handler(async ({ data }) => notesRepo.createNote(data));

export const patchNote = createServerFn({ method: "POST" })
  .validator(NotePatchSchema)
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    return notesRepo.patchNote(id, patch);
  });

export const deleteNote = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => notesRepo.deleteNote(data.id));
