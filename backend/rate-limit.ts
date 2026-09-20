const buckets = new Map<string, number[]>();

export function allowRequest(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const prev = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (prev.length >= limit) {
    buckets.set(key, prev);
    return false;
  }
  prev.push(now);
  buckets.set(key, prev);
  if (buckets.size > 5000) {
    for (const [k, list] of buckets) {
      if (!list.length || now - list[list.length - 1] > windowMs) buckets.delete(k);
    }
  }
  return true;
}
