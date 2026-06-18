import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="text-sm text-muted-foreground">Ładowanie...</span>
      </div>
    );
  }

  if (!user) return null;

  return <Outlet />;
}
