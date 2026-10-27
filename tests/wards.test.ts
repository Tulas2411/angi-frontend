import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDistricts } from "@/app/api/locations/provinces/[code]/districts/route";
import { GET as getWards } from "@/app/api/locations/districts/[code]/wards/route";
import {
  districtNameKey,
  readDistrictCatalog,
  readWardCatalog,
} from "@/shared/locations/provinces";

vi.mock("server-only", () => ({}));
const districts = [
  { code: 1, name: "Quận Ba Đình", province_code: 1 },
  { code: 2, name: "Quận Hoàn Kiếm", province_code: 1 },
];
const wards = [
  { code: 1, name: "Phường Phúc Xá", district_code: 1 },
  { code: 4, name: "Phường Trúc Bạch", district_code: 1 },
];
const districtRequest = (code: string) =>
  getDistricts(
    new Request("http://localhost/api/locations/provinces/1/districts"),
    {
      params: Promise.resolve({ code }),
    },
  );
const wardRequest = (code: string) =>
  getWards(new Request("http://localhost/api/locations/districts/1/wards"), {
    params: Promise.resolve({ code }),
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("V1 province-to-district boundary", () => {
  it("fetches only the selected province from the pre-merger catalog", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ code: 1, districts }));
    vi.stubGlobal("fetch", fetcher);
    const response = await districtRequest("1");
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(
      readDistrictCatalog(districts),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://provinces.open-api.vn/api/v1/p/1?depth=2",
      expect.objectContaining({ next: { revalidate: 86400 } }),
    );
  });
  it.each(["0", "100", "../d", "1?depth=3", "abc"])(
    "rejects invalid province code %s before fetching",
    async (code) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect((await districtRequest(code)).status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { code: 48, districts },
    { code: 1, districts: [{ ...districts[0], province_code: 48 }] },
    { code: 1, districts: [{ name: "Missing code", province_code: 1 }] },
  ])("rejects malformed or cross-province provider data", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect((await districtRequest("1")).status).toBe(503);
  });
  it("treats “Quận Hoàn Kiếm” and “Hoàn Kiếm” as one district", () => {
    expect(districtNameKey("Quận Hoàn Kiếm")).toBe(
      districtNameKey("Hoàn Kiếm"),
    );
    expect(districtNameKey("Huyện Sóc Sơn")).toBe("soc son");
    expect(districtNameKey("Thị xã Sơn Tây")).toBe("son tay");
  });
});

describe("V1 district-to-ward boundary", () => {
  it("fetches only the selected district and strips unrelated provider metadata", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ code: 1, wards }));
    vi.stubGlobal("fetch", fetcher);
    const response = await wardRequest("1");
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(readWardCatalog(wards));
    expect(fetcher).toHaveBeenCalledWith(
      "https://provinces.open-api.vn/api/v1/d/1?depth=2",
      expect.objectContaining({ next: { revalidate: 86400 } }),
    );
    expect(readWardCatalog([])).toEqual([]);
  });
  it.each(["0", "1000", "../w", "1?depth=3", "abc"])(
    "rejects invalid district code %s before fetching",
    async (code) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect((await wardRequest(code)).status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { code: 2, wards },
    { code: 1, wards: [{ ...wards[0], district_code: 2 }] },
    { code: 1, wards: [{ name: "Missing code", district_code: 1 }] },
  ])("rejects malformed or cross-district provider data", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    expect((await wardRequest("1")).status).toBe(503);
  });
  it("returns a safe retryable error when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Upstream error")),
    );
    const response = await wardRequest("1");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      errorCode: "SERVICE_UNAVAILABLE",
      data: null,
    });
  });
});

describe("district and ward catalog isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
  });
  it("asks districts by province and wards by district", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, data: districts }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { loadDistrictCatalog, loadWardCatalog } =
      await import("@/shared/locations/ward-service");
    await loadDistrictCatalog(1);
    await loadWardCatalog(2);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/locations/provinces/1/districts",
      "/api/locations/districts/2/wards",
    ]);
  });
  it("deduplicates by district and expires each successful cache independently", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, data: wards }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { loadWardCatalog } = await import("@/shared/locations/ward-service");
    await Promise.all([loadWardCatalog(1), loadWardCatalog(1)]);
    await loadWardCatalog(490);
    await loadWardCatalog(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await loadWardCatalog(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("a delayed previous district cannot replace the active district's catalog", async () => {
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
            data: [{ code: 20194, name: "Phường Hòa Hiệp Bắc" }],
          }),
        ),
    );
    const { loadWardCatalog, getWardCatalog } =
      await import("@/shared/locations/ward-service");
    const earlier = loadWardCatalog(1);
    await loadWardCatalog(490);
    resolveFirst(Response.json({ success: true, data: wards }));
    await earlier;
    expect(getWardCatalog(490).items).toEqual([
      { code: 20194, name: "Phường Hòa Hiệp Bắc" },
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
