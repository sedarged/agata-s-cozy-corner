// Agata — server functions for reading sessions. Zod-validated.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as sessionsRepo from "@/lib/db/repositories/reading-sessions";
import { SessionInputSchema, SessionPatchSchema } from "@/lib/api/schemas";

export const listSessions = createServerFn({ method: "POST" }).handler(async () => {
  return sessionsRepo.listSessions();
});

export const listSessionsForBook = createServerFn({ method: "POST" })
  .validator(z.object({ bookId: z.string() }))
  .handler(async ({ data }) => sessionsRepo.listSessionsForBook(data.bookId));

export const listSessionsBetween = createServerFn({ method: "POST" })
  .validator(z.object({ startISO: z.string(), endISO: z.string() }))
  .handler(async ({ data }) => sessionsRepo.listSessionsBetween(data.startISO, data.endISO));

export const createSession = createServerFn({ method: "POST" })
  .validator(SessionInputSchema)
  .handler(async ({ data }) => sessionsRepo.createSession(data));

export const patchSession = createServerFn({ method: "POST" })
  .validator(SessionPatchSchema)
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    return sessionsRepo.patchSession(id, patch);
  });

export const deleteSession = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => sessionsRepo.deleteSession(data.id));
