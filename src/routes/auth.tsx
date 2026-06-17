import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Mail, KeyRound } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Welcome — Agata" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [ownerClaimed, setOwnerClaimed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from("app_config").select("owner_user_id").maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const claimed = !!data?.owner_user_id;
      setOwnerClaimed(claimed);
      setMode(claimed ? "signin" : "signup");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !cancelled) navigate({ to: "/" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (ownerClaimed) throw new Error("Rejestracja zamknięta — to prywatna aplikacja Agaty.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          await supabase.rpc("claim_ownership");
          navigate({ to: "/" });
        } else {
          setError("Sprawdź email — potwierdź adres, aby kontynuować.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await supabase.rpc("claim_ownership"); // no-op if already owner
        navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coś poszło nie tak.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-gradient-to-br from-background to-muted/40">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary text-primary-foreground grid place-items-center font-serif italic text-3xl shadow-warm">A</div>
          <h1 className="font-serif text-4xl mt-5">Agata</h1>
          <p className="text-sm text-muted-foreground mt-1">Your private library, notes and Gigi.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-3xl p-6 shadow-soft space-y-4">
          <h2 className="font-serif text-xl">
            {mode === "signin" ? "Zaloguj się" : ownerClaimed ? "Rejestracja zamknięta" : "Stwórz swoje konto"}
          </h2>

          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Email</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm"
                placeholder="agata@example.com"
              />
            </div>
          </label>

          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Hasło</div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-3 text-sm"
                placeholder="••••••••"
              />
            </div>
          </label>

          {error && <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</div>}

          <button
            disabled={loading || (mode === "signup" && ownerClaimed === true)}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "…" : mode === "signin" ? "Wejdź do biblioteki" : "Załóż konto"}
          </button>

          {!ownerClaimed && (
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "Nie masz konta? Załóż je." : "Masz już konto? Zaloguj się."}
            </button>
          )}

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Wszystko jest prywatne. Konto może utworzyć tylko pierwsza osoba — później rejestracja jest zamknięta.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
