import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import {
  getSupabaseClientOrNull,
  isSupabaseConfigured,
  SUPABASE_UNAVAILABLE_MESSAGE,
} from "@/lib/supabase-safe";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  supabaseAvailable: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const unavailableError = () => new Error(SUPABASE_UNAVAILABLE_MESSAGE);

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  supabaseAvailable: false,
  signIn: async () => ({ error: unavailableError() }),
  signUp: async () => ({ error: unavailableError() }),
  signInWithGoogle: async () => ({ error: unavailableError() }),
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseAvailable = isSupabaseConfigured();

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const client = getSupabaseClientOrNull();
    if (!client) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    try {
      client.auth
        .getSession()
        .then(({ data }) => {
          if (cancelled) return;
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setLoading(false);
        })
        .catch((e) => {
          console.warn("[auth] getSession failed:", e);
          if (!cancelled) setLoading(false);
        });
      const { data: listener } = client.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
      });
      return () => {
        cancelled = true;
        listener.subscription.unsubscribe();
      };
    } catch (e) {
      console.warn("[auth] init failed:", e);
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClientOrNull();
    if (!client) return { error: unavailableError() };
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return { error };
    } catch (e) {
      return { error: e instanceof Error ? e : unavailableError() };
    }
  };

  const signUp = async (email: string, password: string) => {
    const client = getSupabaseClientOrNull();
    if (!client) return { error: unavailableError() };
    try {
      const { error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin + "/auth" : undefined,
        },
      });
      return { error };
    } catch (e) {
      return { error: e instanceof Error ? e : unavailableError() };
    }
  };

  const signInWithGoogle = async () => {
    const client = getSupabaseClientOrNull();
    if (!client) return { error: unavailableError() };
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin + "/auth" : undefined,
        },
      });
      return { error };
    } catch (e) {
      return { error: e instanceof Error ? e : unavailableError() };
    }
  };

  const signOut = async () => {
    const client = getSupabaseClientOrNull();
    if (!client) {
      // Just clear local auth state — never wipe localStorage data.
      setSession(null);
      setUser(null);
      return { error: null };
    }
    try {
      const { error } = await client.auth.signOut();
      return { error };
    } catch (e) {
      return { error: e instanceof Error ? e : null };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        supabaseAvailable,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
