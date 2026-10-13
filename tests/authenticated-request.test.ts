import { describe, expect, it, vi } from "vitest";
import { runAuthenticated } from "@/features/auth/authenticated-request";
import { createRefreshCoordinator } from "@/features/auth/refresh-coordinator";
import { ApiError } from "@/shared/api/error";
import type { AuthResultDto } from "@/features/auth/types";

const auth = {
  accessToken: "old-access",
  accessTokenExpiresAt: "2035-01-01T00:00:00Z",
  refreshToken: "old-refresh",
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
const fresh = {
  ...auth,
  accessToken: "new-access",
  refreshToken: "new-refresh",
};
describe("authenticated requests", () => {
  it("rotates once after UNAUTHORIZED and retries with the new token pair", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "expired"))
      .mockResolvedValueOnce("ok");
    const rotate = vi.fn().mockResolvedValue(fresh);
    await expect(runAuthenticated(auth, send, rotate)).resolves.toBe("ok");
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith(fresh);
  });
  it("never loops if the replacement access token is rejected", async () => {
    const send = vi
      .fn()
      .mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "bad"));
    const rotate = vi.fn().mockResolvedValue(fresh);
    await expect(runAuthenticated(auth, send, rotate)).rejects.toMatchObject({
      errorCode: "UNAUTHORIZED",
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(rotate).toHaveBeenCalledTimes(1);
  });
  it.each([
    "FORBIDDEN",
    "INVALID_CREDENTIALS",
    "TOKEN_EXPIRED",
    "REFRESH_TOKEN_INVALID",
    "ACCOUNT_SUSPENDED",
  ])("does not refresh %s", async (code) => {
    const rotate = vi.fn();
    await expect(
      runAuthenticated(
        auth,
        async () => {
          throw new ApiError(403, code, "failed");
        },
        rotate,
      ),
    ).rejects.toMatchObject({ errorCode: code });
    expect(rotate).not.toHaveBeenCalled();
  });
  it("refreshes an expired access token before sending and stops on refresh failure", async () => {
    const expired = { ...auth, accessTokenExpiresAt: "2000-01-01T00:00:00Z" };
    const send = vi.fn().mockResolvedValue("ok");
    await runAuthenticated(expired, send, async () => fresh);
    expect(send).toHaveBeenCalledWith(fresh);
    const never = vi.fn();
    await expect(
      runAuthenticated(expired, never, async () => {
        throw new ApiError(401, "REFRESH_TOKEN_INVALID", "revoked");
      }),
    ).rejects.toMatchObject({ errorCode: "REFRESH_TOKEN_INVALID" });
    expect(never).not.toHaveBeenCalled();
  });
});
describe("rotating token coordination", () => {
  it("shares the same refresh across simultaneous and delayed requests", async () => {
    let clock = 0;
    const coordinate = createRefreshCoordinator<AuthResultDto>(
      30_000,
      () => clock,
    );
    const rotate = vi.fn(async () => fresh);
    const results = await Promise.all(
      Array.from({ length: 25 }, () => coordinate("same-token", rotate)),
    );
    expect(results.every((result) => result === fresh)).toBe(true);
    expect(rotate).toHaveBeenCalledTimes(1);
    clock = 29_999;
    await coordinate("same-token", rotate);
    expect(rotate).toHaveBeenCalledTimes(1);
    await coordinate("different-token", rotate);
    expect(rotate).toHaveBeenCalledTimes(2);
  });
  it("shares failures instead of issuing concurrent retries", async () => {
    const coordinate = createRefreshCoordinator<AuthResultDto>();
    const rotate = vi.fn(async () => {
      throw new ApiError(401, "REFRESH_TOKEN_INVALID", "revoked");
    });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => coordinate("token", rotate)),
    );
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(rotate).toHaveBeenCalledTimes(1);
  });
});
