import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readProvinceCatalog } from "@/shared/locations/provinces";
import { searchText } from "@/shared/text/search";
import { GET } from "@/app/api/locations/provinces/route";
import { matchesRestaurantLocation } from "@/shared/locations/restaurant-search";

vi.mock("server-only", () => ({}));

const catalog = [
  { name: "Thành phố Hà Nội", code: 1 },
  { name: "Tỉnh Điện Biên", code: 11 },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("province catalog boundary", () => {
  it("matches official province names against existing short names and street searches", () => {
    const restaurant = {
      name: "Bếp Nhà",
      address: "24 Nguyễn Hữu Huân",
      district: "Hoàn Kiếm",
      province: "Hà Nội",
    };
    expect(matchesRestaurantLocation(restaurant, "Thành phố Hà Nội")).toBe(
      true,
    );
    expect(matchesRestaurantLocation(restaurant, "nguyen huu huan")).toBe(true);
    expect(matchesRestaurantLocation(restaurant, "Thành phố Đà Nẵng")).toBe(
      false,
    );
  });
  it("preserves official names, strips provider metadata and deduplicates", () => {
    expect(
      readProvinceCatalog([...catalog, { name: " Thành phố Hà Nội " }]),
    ).toEqual([{ name: "Thành phố Hà Nội" }, { name: "Tỉnh Điện Biên" }]);
    for (const payload of [
      null,
      {},
      [],
      [{ code: 1 }],
      [{ name: "" }],
      [{ name: "x".repeat(101) }],
    ])
      expect(() => readProvinceCatalog(payload)).toThrow();
  });
  it("matches unaccented Vietnamese input without rewriting stored values", () => {
    expect(searchText("Tỉnh Điện Biên")).toContain(searchText("dien bien"));
    expect(searchText("Thành phố Đà Nẵng")).toContain(searchText("DA NANG"));
  });
  it("uses the fixed V1 provider and returns an ANGI response", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(catalog));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(readProvinceCatalog(catalog));
    expect(fetcher).toHaveBeenCalledWith(
      "https://provinces.open-api.vn/api/v1/",
      expect.objectContaining({ next: { revalidate: 86400 } }),
    );
  });
  it.each([
    new Error("Network error"),
    Response.json({}, { status: 200 }),
    Response.json({}, { status: 503 }),
  ])(
    "returns safe retryable feedback for a failed catalog",
    async (failure) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockImplementation(() =>
            failure instanceof Error
              ? Promise.reject(failure)
              : Promise.resolve(failure),
          ),
      );
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        success: false,
        errorCode: "SERVICE_UNAVAILABLE",
        data: null,
      });
    },
  );
});

describe("shared province loading", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
  });
  it("shares concurrent requests and expires the browser cache", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, data: catalog }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { loadProvinceCatalog } =
      await import("@/shared/locations/province-service");
    await Promise.all([loadProvinceCatalog(), loadProvinceCatalog()]);
    await loadProvinceCatalog();
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await loadProvinceCatalog();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not cache failed requests and permits retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { success: false, errorCode: "SERVICE_UNAVAILABLE", data: null },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ success: true, data: catalog }));
    vi.stubGlobal("fetch", fetcher);
    const {
      loadProvinceCatalog,
      getProvinceCatalog,
      subscribeProvinceCatalog,
    } = await import("@/shared/locations/province-service");
    const observed = vi.fn();
    const unsubscribe = subscribeProvinceCatalog(observed);
    await expect(loadProvinceCatalog()).rejects.toMatchObject({ status: 503 });
    expect(getProvinceCatalog().status).toBe("error");
    await expect(loadProvinceCatalog()).resolves.toEqual(
      readProvinceCatalog(catalog),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(getProvinceCatalog()).toMatchObject({
      status: "ready",
      items: readProvinceCatalog(catalog),
    });
    expect(observed).toHaveBeenCalled();
    unsubscribe();
  });
});
