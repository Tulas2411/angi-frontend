import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/locations/provinces/[code]/wards/route";
import { readWardCatalog } from "@/shared/locations/provinces";

vi.mock("server-only", () => ({}));
const wards = [
  { code: 4, name: "Phường Ba Đình", province_code: 1 },
  { code: 8, name: "Phường Ngọc Hà", province_code: 1 },
];
const request = (code: string) =>
  GET(new Request("http://localhost/api/locations/provinces/1/wards"), {
    params: Promise.resolve({ code }),
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("V2 province-to-ward boundary", () => {
  it("fetches only the selected province and strips unrelated provider metadata", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ code: 1, wards }));
    vi.stubGlobal("fetch", fetcher);
    const response = await request("1");
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(readWardCatalog(wards));
    expect(fetcher).toHaveBeenCalledWith(
      "https://provinces.open-api.vn/api/v2/p/1?depth=2",
      expect.objectContaining({ next: { revalidate: 86400 } }),
    );
    expect(readWardCatalog([])).toEqual([]);
  });
  it.each(["0", "100", "../w", "1?depth=3", "abc"])(
    "rejects invalid province code %s before fetching",
    async (code) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect((await request(code)).status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { code: 48, wards },
    { code: 1, wards: [{ ...wards[0], province_code: 48 }] },
    { code: 1, wards: [{ name: "Missing code", province_code: 1 }] },
  ])("rejects malformed or cross-province provider data", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect((await request("1")).status).toBe(503);
  });
  it("returns a safe retryable error when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Upstream error")),
    );
    const response = await request("1");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      errorCode: "SERVICE_UNAVAILABLE",
      data: null,
    });
  });
});

describe("ward catalog isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
  });
  it("deduplicates by province and expires each successful cache independently", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, data: wards }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { loadWardCatalog } = await import("@/shared/locations/ward-service");
    await Promise.all([loadWardCatalog(1), loadWardCatalog(1)]);
    await loadWardCatalog(48);
    await loadWardCatalog(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await loadWardCatalog(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("a delayed previous province cannot replace the active province's catalog", async () => {
    let resolveFirst: (response: Response) => void = () => {};
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(first)
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            data: [{ code: 20194, name: "Phường Hải Châu" }],
          }),
        ),
    );
    const { loadWardCatalog, getWardCatalog } =
      await import("@/shared/locations/ward-service");
    const earlier = loadWardCatalog(1);
    await loadWardCatalog(48);
    resolveFirst(Response.json({ success: true, data: wards }));
    await earlier;
    expect(getWardCatalog(48).items).toEqual([
      { code: 20194, name: "Phường Hải Châu" },
    ]);
    expect(getWardCatalog(1).items).toEqual(readWardCatalog(wards));
  });
  it("failed requests can retry without caching the error", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { success: false, errorCode: "SERVICE_UNAVAILABLE", data: null },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ success: true, data: wards }));
    vi.stubGlobal("fetch", fetcher);
    const { loadWardCatalog, getWardCatalog } =
      await import("@/shared/locations/ward-service");
    await expect(loadWardCatalog(1)).rejects.toMatchObject({ status: 503 });
    expect(getWardCatalog(1).status).toBe("error");
    await loadWardCatalog(1);
    expect(getWardCatalog(1).status).toBe("ready");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
