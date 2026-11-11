import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/locations/province-service", () => ({
  loadProvinceCatalog: vi.fn(async () => [
    { code: 1, name: "Thành phố Hà Nội" },
    { code: 48, name: "Thành phố Đà Nẵng" },
  ]),
}));
vi.mock("@/shared/locations/ward-service", () => ({
  loadWardCatalog: vi.fn(async (code: number) =>
    code === 1
      ? [
          { code: 1, name: "Phường Hàng Bạc" },
          { code: 2, name: "Phường Hoàn Kiếm" },
        ]
      : [],
  ),
}));

const { catalogAddress } =
  await import("@/features/owner/restaurant-location-rules");

describe("map-filled address against the catalog", () => {
  it("renames a known province and ward to their catalog names", async () => {
    expect(await catalogAddress("Hà Nội", "Hàng Bạc")).toEqual({
      provinceName: "Thành phố Hà Nội",
      ward: "Phường Hàng Bạc",
    });
  });

  it("drops what the catalog does not know so the owner picks it", async () => {
    expect(await catalogAddress("Hà Nội", "Phường Không Có")).toEqual({
      provinceName: "Thành phố Hà Nội",
      ward: "",
    });
    expect(await catalogAddress("Tỉnh Không Có", "Hàng Bạc")).toEqual({
      provinceName: "",
      ward: "",
    });
  });

  it("keeps an empty ward empty", async () => {
    expect(await catalogAddress("Đà Nẵng", "")).toEqual({
      provinceName: "Thành phố Đà Nẵng",
      ward: "",
    });
  });
});
