// Cloud sync GATE — read-only diagnostics for now.
// This module does NOT push to Supabase, does NOT pull from Supabase,
// does NOT modify localStorage. It only reports readiness and lets the
// Settings UI compare local vs cloud counts when it is safe to do so.
//
// Future Gigi integration is intended to flow through the owner's ChatGPT
// subscription/OAuth-style connection, NOT through a raw API key set here.

import { useEffect, useState } from "react";
import { getAllBooks } from "@/lib/books-store";
import { getAllNotes } from "@/lib/notes-store";
import { getStoredSessions } from "@/lib/book-workspace-store";
import {
  getSupabaseClientOrNull,
  isSupabaseConfigured,
} from "@/lib/supabase-safe";
import { noteHasLocalOnlyMedia } from "@/lib/supabase-mappers";

export type CloudSyncStatus =
  | "local-only"
  | "configured-logged-out"
  | "configured-logged-in"
  | "config-error"
  | "rls-unverified"
  | "owner-gate-unverified";

export interface CloudReadiness {
  configured: boolean;
  loggedIn: boolean;
  userId: string | null;
  email: string | null;
  ownerVerified: boolean | null; // null = not checked
  rlsVerified: boolean | null;   // null = not checked
  canPush: boolean;
  canPull: boolean;
  reasons: string[]; // Polish, human-readable
}

export function isCloudConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function getCurrentUserId(): Promise<string | null> {
  const client = getSupabaseClientOrNull();
  if (!client) return null;
  try {
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function checkCloudReadiness(): Promise<CloudReadiness> {
  const reasons: string[] = [];
  const configured = isCloudConfigured();
  if (!configured) {
    return {
      configured: false,
      loggedIn: false,
      userId: null,
      email: null,
      ownerVerified: null,
      rlsVerified: null,
      canPush: false,
      canPull: false,
      reasons: ["Błąd konfiguracji"],
    };
  }
  const client = getSupabaseClientOrNull();
  if (!client) {
    return {
      configured: false,
      loggedIn: false,
      userId: null,
      email: null,
      ownerVerified: null,
      rlsVerified: null,
      canPush: false,
      canPull: false,
      reasons: ["Błąd konfiguracji"],
    };
  }

  let userId: string | null = null;
  let email: string | null = null;
  try {
    const { data } = await client.auth.getUser();
    userId = data.user?.id ?? null;
    email = data.user?.email ?? null;
  } catch {
    /* noop */
  }
  if (!userId) {
    return {
      configured: true,
      loggedIn: false,
      userId: null,
      email: null,
      ownerVerified: null,
      rlsVerified: null,
      canPush: false,
      canPull: false,
      reasons: ["Wymaga logowania"],
    };
  }

  // Owner gate: verify against app_config.owner_user_id (user-scoped read).
  let ownerVerified: boolean | null = null;
  try {
    const { data: cfg, error } = await client
      .from("app_config")
      .select("owner_user_id")
      .eq("id", 1)
      .maybeSingle();
    if (!error && cfg && cfg.owner_user_id) {
      ownerVerified = cfg.owner_user_id === userId;
    } else if (!error && cfg && !cfg.owner_user_id) {
      ownerVerified = false; // not claimed yet
    }
  } catch {
    ownerVerified = null;
  }

  // RLS user-scoped probe: read own books. If this returns rows OR an empty
  // array without error, the policy is reachable as the authenticated user.
  // We cannot prove RLS denies other rows from the client side alone, so we
  // mark it "unverified" until a deliberate, audited verification is added.
  let rlsVerified: boolean | null = null;
  try {
    const { error } = await client.from("books").select("id").limit(1);
    rlsVerified = error ? false : null; // never claim "verified" from anon probes
  } catch {
    rlsVerified = false;
  }

  if (ownerVerified === false) reasons.push("Owner gate niezweryfikowany");
  if (rlsVerified === null) reasons.push("RLS niezweryfikowane");
  if (rlsVerified === false) reasons.push("Brak dostępu (RLS)");

  // Local notes with handwriting/base64 photos cannot be safely pushed.
  const blockedNotes = getAllNotes().filter(noteHasLocalOnlyMedia).length;
  if (blockedNotes > 0) {
    reasons.push("Notatki ręczne wymagają dodatkowego planu migracji");
  }

  const canPush = false; // intentionally disabled in this pass
  const canPull = false; // intentionally disabled in this pass

  return {
    configured: true,
    loggedIn: true,
    userId,
    email,
    ownerVerified,
    rlsVerified,
    canPush,
    canPull,
    reasons,
  };
}

export interface LocalCounts {
  books: number;
  notes: number;
  sessions: number;
  notesBlocked: number;
}

export function getLocalCounts(): LocalCounts {
  const notes = getAllNotes();
  return {
    books: getAllBooks().length,
    notes: notes.length,
    sessions: getStoredSessions().length,
    notesBlocked: notes.filter(noteHasLocalOnlyMedia).length,
  };
}

export interface CloudCounts {
  ok: boolean;
  error?: string;
  books?: number;
  notes?: number;
  sessions?: number;
}

export async function fetchCloudSnapshot(userId: string): Promise<CloudCounts> {
  const client = getSupabaseClientOrNull();
  if (!client) return { ok: false, error: "Błąd konfiguracji" };
  try {
    const [b, n, s] = await Promise.all([
      client.from("books").select("id", { count: "exact", head: true }).eq("user_id", userId),
      client.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      client
        .from("reading_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
    if (b.error || n.error || s.error) {
      return {
        ok: false,
        error: b.error?.message || n.error?.message || s.error?.message || "fetch failed",
      };
    }
    return {
      ok: true,
      books: b.count ?? 0,
      notes: n.count ?? 0,
      sessions: s.count ?? 0,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ComparisonResult {
  local: LocalCounts;
  cloud: CloudCounts;
  readiness: CloudReadiness;
}

export async function compareLocalAndCloud(): Promise<ComparisonResult> {
  const readiness = await checkCloudReadiness();
  const local = getLocalCounts();
  const cloud =
    readiness.loggedIn && readiness.userId
      ? await fetchCloudSnapshot(readiness.userId)
      : { ok: false, error: readiness.reasons[0] ?? "" };
  return { local, cloud, readiness };
}

export function getCloudSyncStatus(readiness: CloudReadiness): CloudSyncStatus {
  if (!readiness.configured) return "config-error";
  if (!readiness.loggedIn) return "configured-logged-out";
  if (readiness.ownerVerified === false) return "owner-gate-unverified";
  if (readiness.rlsVerified === false) return "rls-unverified";
  return "configured-logged-in";
}

export function useCloudSyncStatus() {
  const [state, setState] = useState<{
    loading: boolean;
    readiness: CloudReadiness | null;
  }>({ loading: true, readiness: null });

  useEffect(() => {
    let cancelled = false;
    checkCloudReadiness()
      .then((r) => {
        if (!cancelled) setState({ loading: false, readiness: r });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, readiness: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Explicit guards. These will throw if called while disabled — callers must
// check `canPush`/`canPull` first and surface the readiness reasons in UI.
export async function pushLocalToCloud(): Promise<never> {
  throw new Error(
    "Synchronizacja z chmurą jest w tym wydaniu wyłączona. Sprawdź stan w Ustawieniach.",
  );
}

export async function pullCloudToLocal(): Promise<never> {
  throw new Error(
    "Synchronizacja z chmurą jest w tym wydaniu wyłączona. Sprawdź stan w Ustawieniach.",
  );
}
