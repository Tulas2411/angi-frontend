import type { AuthResultDto } from "./types";

// Keep the latest rotated pair when a delayed response brings back an older cookie.
// Replace this registry with a shared store before running multiple instances.
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
