import { describe, expect, it } from "vitest";
import { createSessionRegistry } from "@/features/auth/session-registry";
import type { AuthResultDto } from "@/features/auth/types";

const auth = {
  accessToken: "access",
  refreshToken: "refresh",
  accessTokenExpiresAt: "2035-01-01T00:00:00Z",
  refreshTokenExpiresAt: "2035-02-01T00:00:00Z",
  user: {
    id: 1,
    email: "test@angi.local",
    displayName: "Test",
    role: "TRAVELER",
    status: "active",
    avatarUrl: null,
    needsPreferenceSurvey: null,
  },
} satisfies AuthResultDto;

describe("session registry", () => {
  it("keeps the latest pair beyond the short refresh deduplication window", () => {
    let clock = 0;
    const registry = createSessionRegistry(() => clock);
    registry.save("session", auth);
    const fresh = { ...auth, refreshToken: "rotated" };
    registry.save("session", fresh);
    clock = 60_000;
    expect(registry.get("session")).toBe(fresh);
  });
  it("prevents an in-flight refresh from recreating a logged-out session", () => {
    const registry = createSessionRegistry(() => 0);
    registry.save("session", auth);
    registry.revoke("session", Date.parse(auth.refreshTokenExpiresAt));
    expect(registry.save("session", auth)).toBe(false);
    expect(registry.get("session")).toBeUndefined();
    expect(registry.isRevoked("session")).toBe(true);
    expect(registry.save("new-login", auth)).toBe(true);
  });
  it("expires stored token pairs and revocations", () => {
    let clock = 0;
    const registry = createSessionRegistry(() => clock);
    registry.save("active", auth);
    registry.revoke("revoked", Date.parse(auth.refreshTokenExpiresAt));
    clock = Date.parse(auth.refreshTokenExpiresAt);
    expect(registry.get("active")).toBeUndefined();
    expect(registry.isRevoked("revoked")).toBe(false);
  });
});
