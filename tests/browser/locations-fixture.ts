import type { Page } from "@playwright/test";

/** Districts by V1 province code (pre-merger catalog). */
export const districtCatalogs: Record<
  string,
  { code: number; name: string }[]
> = {
  "1": [
    { code: 1, name: "Quận Ba Đình" },
    { code: 2, name: "Quận Hoàn Kiếm" },
  ],
  "48": [
    { code: 492, name: "Quận Hải Châu" },
    { code: 491, name: "Quận Thanh Khê" },
  ],
  "11": [{ code: 94, name: "Thành phố Điện Biên Phủ" }],
};

/** Wards by V1 district code. */
export const wardCatalogs: Record<string, { code: number; name: string }[]> = {
  "1": [
    { code: 1, name: "Phường Điện Biên" },
    { code: 4, name: "Phường Ngọc Hà" },
  ],
  "2": [{ code: 37, name: "Phường Hàng Bạc" }],
  "492": [
    { code: 20227, name: "Phường Hải Châu I" },
    { code: 20230, name: "Phường Thạch Thang" },
  ],
  "94": [{ code: 3127, name: "Phường Mường Thanh" }],
};

export async function stubWardCatalogs(page: Page) {
  await page.route("**/api/locations/provinces/*/districts", (route) => {
    const code =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    return route.fulfill({
      json: { success: true, data: districtCatalogs[code] ?? [] },
    });
  });
  await page.route("**/api/locations/districts/*/wards", (route) => {
    const code =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    return route.fulfill({
      json: { success: true, data: wardCatalogs[code] ?? [] },
    });
  });
}
