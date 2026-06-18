// /search is a legacy alias — the real book search lives in /add-book.
// Redirect to /add-book so users land on the real, API-driven search flow.
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Wyszukiwanie — Agata" }] }),
  component: SearchRedirect,
});

function SearchRedirect() {
  return <Navigate to="/add-book" replace />;
}
