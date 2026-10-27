import type { Page } from "@playwright/test";

export const wardCatalogs: Record<string, { code: number; name: string }[]> = {
  "1": [
    { code: 4, name: "Phường Ba Đình" },
    { code: 8, name: "Phường Ngọc Hà" },
  ],
  "48": [
    { code: 20194, name: "Phường Hải Châu" },
    { code: 20200, name: "Phường Thanh Khê" },
  ],
  "11": [{ code: 3157, name: "Phường Điện Biên Phủ" }],
};

export async function stubWardCatalogs(page: Page) {
  await page.route("**/api/locations/provinces/*/wards", (route) => {
    const code =
      new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    return route.fulfill({
      json: { success: true, data: wardCatalogs[code] ?? [] },
    });
  });
}
