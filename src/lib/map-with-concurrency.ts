// map-with-concurrency.ts — bounded-concurrency async map. Caps the
// number of in-flight tasks at `limit` so a single batch request can't
// fan out to dozens of upstream calls at once. Used by
// /api/book-search/batch to keep a 20-ISBN request from amplifying
// into 20×3 = 60 parallel HTTP fetches.

export async function mapWithConcurrency<T, R>(
  limit: number,
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const cap = Math.max(1, Math.min(limit, items.length));
  const out: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: cap }, () => worker());
  await Promise.all(workers);
  return out;
}
