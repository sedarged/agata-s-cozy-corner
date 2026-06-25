// Agata — single entry point for surfacing mutation failures.
//
// H6 fix: read.tsx + book.$id.read.tsx had silent `catch {}` blocks that
// swallowed rejection errors. The user got no feedback at all on a failed
// save. Convention used everywhere else in the app is:
//   toast.error(message)
// where `message` is either the server-supplied error.message (most useful
// for ZodValidation failures) or a Polish fallback for unknown shapes.
//
// The function is intentionally PURE (returns the resolved message string)
// so tests don't need to mock `sonner` — the caller is responsible for the
// toast.error() side-effect. One place to evolve the toast UX later.
export function resolveMutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
