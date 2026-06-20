export function readUrlParams(defaults: Record<string, string>): Record<string, string> {
  if (typeof window === "undefined") return { ...defaults };
  const sp = new URLSearchParams(window.location.search);
  const result: Record<string, string> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const val = sp.get(key);
    if (val !== null) result[key] = val;
  }
  return result;
}

export function syncUrl(params: Record<string, string>, defaults: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== defaults[k]) sp.set(k, v);
  }
  const qs = sp.toString();
  window.history.replaceState(
    {},
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}
