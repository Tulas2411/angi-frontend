import { afterEach, describe, expect, it, vi } from "vitest";
import { api, shortRetryAfter } from "@/shared/api/client";
import { ApiError } from "@/shared/api/error";
import { cachedRead, clearReadCache } from "@/shared/api/read-cache";
import {
  exploreService,
  listCacheMs,
} from "@/features/explore/explore-service";

/** A Response in the ApiResponse envelope. */
function answer(
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  const ok = status < 400;
  return new Response(
    JSON.stringify({
      success: ok,
      message: ok ? null : "Bạn gửi quá nhiều yêu cầu.",
      errorCode: ok ? null : "TOO_MANY_REQUESTS",
      data: ok ? data : null,
    }),
    { status, headers: { "Content-Type": "application/json", ...headers } },
  );
}

afterEach(() => {
  clearReadCache();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("short-lived read cache", () => {
  it("reuses a fresh answer, asks again once it is stale and never keeps a failure", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue("first");
    await expect(cachedRead("dishes?q=1", 1000, load)).resolves.toBe("first");
    await expect(cachedRead("dishes?q=1", 1000, load)).resolves.toBe("first");
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    load.mockResolvedValueOnce("second");
    await expect(cachedRead("dishes?q=1", 1000, load)).resolves.toBe("second");
    expect(load).toHaveBeenCalledTimes(2);

    const failing = vi
      .fn()
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValue("ok");
    await expect(cachedRead("tags", 1000, failing)).rejects.toThrow("503");
    await expect(cachedRead("tags", 1000, failing)).resolves.toBe("ok");
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("a list page is asked once for the same URL within listCacheMs, and again after signing out", async () => {
    const fetchMock = vi.fn(async () =>
      answer(200, { items: [], nextCursor: null }),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    await exploreService.browseDishes({ q: "phở", limit: 12 });
    await exploreService.browseDishes({ q: "phở", limit: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await exploreService.browseDishes({ q: "bún", limit: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(listCacheMs).toBe(30_000);
    clearReadCache();
    await exploreService.browseDishes({ q: "phở", limit: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("a read refused with 429", () => {
  it("is sent again once after a short Retry-After", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(answer(429, null, { "Retry-After": "2" }))
      .mockResolvedValueOnce(answer(200, [{ id: 1 }]));
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    const result = api.getOptional("tags");
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is not retried for a long wait, a second refusal or a write", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    const long = vi.fn(async () => answer(429, null, { "Retry-After": "60" }));
    vi.stubGlobal("fetch", long);
    await expect(api.getOptional("tags")).rejects.toMatchObject({
      status: 429,
      retryAfter: "60",
    });
    expect(long).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const twice = vi.fn(async () => answer(429, null, { "Retry-After": "0" }));
    vi.stubGlobal("fetch", twice);
    const refused = api.getOptional("tags");
    const settled = expect(refused).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(0);
    await settled;
    expect(twice).toHaveBeenCalledTimes(2);

    const write = vi.fn(async () => answer(429, null, { "Retry-After": "1" }));
    vi.stubGlobal("fetch", write);
    await expect(api.post("restaurants/7/reports", {})).rejects.toMatchObject({
      status: 429,
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("reads Retry-After only from a 429 and only up to ten seconds", () => {
    expect(
      shortRetryAfter(
        new ApiError(429, "TOO_MANY_REQUESTS", "", undefined, null, "10"),
      ),
    ).toBe(10);
    expect(
      shortRetryAfter(
        new ApiError(429, "TOO_MANY_REQUESTS", "", undefined, null, "11"),
      ),
    ).toBeNull();
    expect(
      shortRetryAfter(
        new ApiError(429, "TOO_MANY_REQUESTS", "", undefined, null, null),
      ),
    ).toBeNull();
    expect(
      shortRetryAfter(
        new ApiError(503, "SERVICE_UNAVAILABLE", "", undefined, null, "1"),
      ),
    ).toBeNull();
  });

  it("a cancelled read stays a cancellation instead of becoming a connection error", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        init?.signal?.throwIfAborted();
        return answer(200, []);
      }),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      api.getOptional("tags", controller.signal),
    ).rejects.not.toBeInstanceOf(ApiError);
  });
});
