// Safe Supabase access helpers. The local app must keep working even when
// Supabase environment variables are missing, invalid, or the network is
// down. Never throw from these helpers — return null and let callers degrade.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

let _resolved: SupabaseClient<Database> | null | undefined;

function readEnv() {
  const url =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined) ||
    "";
  const key =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined) ||
    "";
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = readEnv();
  return Boolean(url && key);
}

export function getSupabaseClientOrNull(): SupabaseClient<Database> | null {
  if (_resolved !== undefined) return _resolved;
  try {
    if (!isSupabaseConfigured()) {
      _resolved = null;
      return null;
    }
    // Force the lazy proxy in client.ts to instantiate; this throws if env
    // is somehow invalid even though the strings are present.
    void supabase.auth;
    _resolved = supabase as SupabaseClient<Database>;
    return _resolved;
  } catch (e) {
    console.warn("[supabase-safe] client unavailable:", e);
    _resolved = null;
    return null;
  }
}

export const SUPABASE_UNAVAILABLE_MESSAGE =
  "Nie udało się połączyć z Supabase. Aplikacja nadal działa lokalnie na tym urządzeniu.";
