// Private single-user app — no external auth service needed. This shell keeps
// the AuthProvider/useAuth interface intact in case auth ever returns.
import { createContext, useContext, type ReactNode } from "react";

interface AuthUser {
  id: string;
  email?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: null;
  loading: boolean;
  supabaseAvailable: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const noop = async () => ({ error: null });

const defaultValue: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  supabaseAvailable: false,
  signIn: noop,
  signUp: noop,
  signInWithGoogle: noop,
  signOut: noop,
};

const AuthContext = createContext<AuthContextType>(defaultValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={defaultValue}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
