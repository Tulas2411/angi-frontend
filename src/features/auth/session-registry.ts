import type { AuthResultDto } from "./types";

/**
 * The newer of two token pairs for one session: the one whose access token expires later (each refresh moves it on).
 * The registry below lives in one server instance. With several instances (Vercel) another instance may have saved a
 * newer pair in the cookie since, so readers compare instead of always trusting this instance's copy. On a tie the
 * cookie (second) wins.
 */
export function newerAuth(
  stored: AuthResultDto | undefined,
  cookie: AuthResultDto | undefined,
): AuthResultDto | undefined {
  if (!stored) return cookie;
  if (!cookie) return stored;
  return Date.parse(stored.accessTokenExpiresAt) >
    Date.parse(cookie.accessTokenExpiresAt)
    ? stored
    : cookie;
}

// Per instance: keeps the latest rotated pair when a delayed response brings back an older cookie, and blocks an
// in-flight refresh from recreating a session logged out on this instance. Two instances refreshing the same token at
// once are covered by the backend, which gives a token rotated in the last 30 seconds its own session (AUTH-06).
export function createSessionRegistry(now = Date.now) {
  const active = new Map<string, AuthResultDto>();
  const revoked = new Map<string, number>();
  function prune() {
    for (const [id, auth] of active) {
      if (Date.parse(auth.refreshTokenExpiresAt) <= now()) active.delete(id);
    }
    for (const [id, expiresAt] of revoked) {
      if (expiresAt <= now()) revoked.delete(id);
    }
  }
  return {
    get(id: string) {
      prune();
      return active.get(id);
    },
    isRevoked(id: string) {
      prune();
      return revoked.has(id);
    },
    save(id: string, auth: AuthResultDto) {
      prune();
      if (revoked.has(id)) return false;
      active.set(id, auth);
      return true;
    },
    revoke(id: string, expiresAt: number) {
      active.delete(id);
      revoked.set(id, expiresAt);
    },
  };
}
