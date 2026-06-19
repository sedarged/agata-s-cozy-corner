import { useEffect, useState } from "react";

/**
 * Returns true after the component has mounted on the client.
 * Use to gate UI that depends on localStorage (or any browser-only state)
 * so SSR and first client render produce the same markup — eliminating
 * React hydration mismatches.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
