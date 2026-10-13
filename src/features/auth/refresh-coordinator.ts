// Process-local coordination for rotating tokens. A shared store is required when scaling out.
export function createRefreshCoordinator<T>(
  retentionMs = 30_000,
  now = Date.now,
) {
  const jobs = new Map<string, { promise: Promise<T>; expiresAt: number }>();
  return (key: string, run: () => Promise<T>): Promise<T> => {
    for (const [entryKey, entry] of jobs) {
      if (entry.expiresAt <= now()) jobs.delete(entryKey);
    }
    const existing = jobs.get(key);
    if (existing) return existing.promise;
    const entry = { promise: Promise.resolve().then(run), expiresAt: Infinity };
    jobs.set(key, entry);
    const settle = () => {
      entry.expiresAt = now() + retentionMs;
    };
    void entry.promise.then(settle, settle);
    return entry.promise;
  };
}
