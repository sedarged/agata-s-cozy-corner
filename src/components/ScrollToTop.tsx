import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Resets window scroll to top on every route change. Prevents the
 * "page jumps / flashes" feeling when navigating between routes whose
 * scroll positions are not restored by the router (e.g. after add-book
 * pushes a fresh /book/$id route).
 */
export function ScrollToTop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
