import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Mail, Lock, Chrome, ArrowRight, BookOpen, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Logowanie — Agata" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, signInWithGoogle, supabaseAvailable } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Konto utworzone! Sprawdź swoją skrzynkę email, aby potwierdzić rejestrację.");
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError("");
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="ambient-bg" aria-hidden />
      <div className="ambient-orbs" aria-hidden />

      <div className="w-full max-w-md bg-card rounded-3xl p-8 shadow-soft border border-border relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="font-script text-4xl gold-text mb-2">Agata</div>
          </Link>
          <p className="text-sm text-muted-foreground">
            Twoja prywatna przestrzeń na książki i notatki
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setMode("login");
              setError("");
              setSuccess("");
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              mode === "login" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Logowanie
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setError("");
              setSuccess("");
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Rejestracja
          </button>
        </div>

        {!supabaseAvailable && (
          <div className="mb-5 text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-xl">
            Nie udało się połączyć z Supabase. Aplikacja nadal działa lokalnie na tym urządzeniu.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={!supabaseAvailable} className="space-y-4 disabled:opacity-60">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adres email"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Hasło"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {mode === "login" ? "Zaloguj się" : "Utwórz konto"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </fieldset>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs text-muted-foreground">
            <span className="bg-card px-3">lub</span>
          </div>
        </div>

        <button
          onClick={handleGoogle}
          disabled={!supabaseAvailable}
          className="w-full py-3 rounded-xl bg-muted border border-border font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors disabled:opacity-60"
        >
          <Chrome className="w-4 h-4" />
          Kontynuuj z Google
        </button>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Bez publicznych profili, bez reklam — tylko Twoje książki.</span>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          Logując się, akceptujesz warunki korzystania z Agaty.
        </p>
      </div>
    </div>
  );
}
