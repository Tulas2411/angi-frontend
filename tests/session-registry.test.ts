import { describe, expect, it } from "vitest";
import {
  createSessionRegistry,
  newerAuth,
} from "@/features/auth/session-registry";
import { clientIpFrom } from "@/features/auth/client-ip";
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
  it("takes the cookie when another instance saved a newer pair there", () => {
    const older = { ...auth, accessTokenExpiresAt: "2035-01-01T00:00:00Z" };
    const newer = {
      ...auth,
      refreshToken: "rotated-elsewhere",
      accessTokenExpiresAt: "2035-01-01T00:15:00Z",
    };
    expect(newerAuth(older, newer)).toBe(newer);
    expect(newerAuth(newer, older)).toBe(newer);
    expect(newerAuth(undefined, older)).toBe(older);
    expect(newerAuth(older, undefined)).toBe(older);
    // Same pair in both places: the cookie wins.
    const copy = { ...older };
    expect(newerAuth(older, copy)).toBe(copy);
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

describe("client IP for the backend", () => {
  const from = (values: Record<string, string>) =>
    clientIpFrom(new Headers(values));
  it("takes the first x-forwarded-for entry, the client", () => {
    expect(from({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBe(
      "203.0.113.7",
    );
    expect(from({ "x-forwarded-for": "2001:db8::1" })).toBe("2001:db8::1");
  });
  it("falls back to x-real-ip, then to nothing", () => {
    expect(from({ "x-real-ip": "198.51.100.4" })).toBe("198.51.100.4");
    expect(from({})).toBeNull();
  });
  it("drops values that are not an IP", () => {
    expect(from({ "x-forwarded-for": "<script>" })).toBeNull();
    expect(from({ "x-forwarded-for": "unknown" })).toBeNull();
  });
});
