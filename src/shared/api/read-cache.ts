"use client";

/**
 * A short-lived cache of public reads (dish and restaurant lists, tags), so refreshing a page,
 * going Back or picking a filter again within a few seconds reuses the answer instead of asking the
 * backend again (each request counts against its rate limit). Kept in memory and in
 * `sessionStorage` (this tab only, survives a reload); only successful answers are kept.
 */
interface Entry {
  at: number;
  value: unknown;
}

const prefix = "angi.read-cache:";
const memory = new Map<string, Entry>();

function stored(key: string): Entry | null {
  try {
    const text = window.sessionStorage.getItem(prefix + key);
    return text ? (JSON.parse(text) as Entry) : null;
  } catch {
    return null;
  }
}

function store(key: string, entry: Entry) {
  memory.set(key, entry);
  try {
    window.sessionStorage.setItem(prefix + key, JSON.stringify(entry));
  } catch {
    // Storage full or blocked (private mode): the memory copy still serves this page.
  }
}

/** The fresh cached answer for `key`, else `load()`'s answer, kept for `ttlMs`. */
export async function cachedRead<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key) ?? stored(key);
  if (hit && now - hit.at >= 0 && now - hit.at < ttlMs) {
    memory.set(key, hit);
    return hit.value as T;
  }
  const value = await load();
  store(key, { at: Date.now(), value });
  return value;
}

/** Forgets every cached read (after signing in or out, whose lists are ranked differently). */
export function clearReadCache() {
  memory.clear();
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing stored.
  }
}
