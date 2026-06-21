import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Logowanie — Agata" }] }),
  component: AuthPage,
});

// Auth is handled at network level (Caddy/Tailscale) on this VPS app.
// Redirect any direct visits to the home page.
function AuthPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);
  return null;
}
