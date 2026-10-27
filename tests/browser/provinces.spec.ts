import { expect, test } from "@playwright/test";
import { stubMapboxRendering } from "./mapbox-fixture";
import {
  districtCatalogs,
  stubWardCatalogs,
  wardCatalogs,
} from "./locations-fixture";
import {
  openRegistration,
  startOwnerApiStub,
  stopServer,
} from "./owner-api-stub";
import type { Server } from "node:http";

let api: Server;
test.beforeAll(async () => {
  api = await startOwnerApiStub();
});
test.afterAll(async () => {
  await stopServer(api);
});

const provinces = [
  { name: "Thành phố Hà Nội", code: 1 },
  { name: "Thành phố Đà Nẵng", code: 48 },
  { name: "Tỉnh Điện Biên", code: 11 },
  { name: "Tỉnh Lâm Đồng", code: 68 },
];

test.beforeEach(async ({ page }) => {
  await stubMapboxRendering(page);
  await stubWardCatalogs(page);
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({ json: { success: true, data: provinces } }),
  );
});

for (const route of ["/restaurant/register"]) {
  test(`districts follow the province and wards follow the district at ${route}`, async ({
    page,
  }) => {
    await openRegistration(page);
    const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
    const district = page.getByRole("combobox", { name: "Quận / huyện" });
    const ward = page.getByRole("combobox", { name: "Phường / xã" });
    await province.fill("ha noi");
    await page
      .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
      .click();
    await district.fill("ba dinh");
    await page
      .getByRole("option", { name: "Quận Ba Đình", exact: true })
      .click();
    await ward.fill("dien bien");
    await page
      .getByRole("option", { name: "Phường Điện Biên", exact: true })
      .click();
    await expect(ward).toHaveValue("Phường Điện Biên");
    // A new district empties the ward; a new province empties both.
    await district.fill("hoan kiem");
    await page
      .getByRole("option", { name: "Quận Hoàn Kiếm", exact: true })
      .click();
    await expect(ward).toHaveValue("");
    await province.fill("da nang");
    await page
      .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
      .click();
    await expect(district).toHaveValue("");
    await district.fill("hai chau");
    await expect(
      page.getByRole("option", { name: "Quận Ba Đình", exact: true }),
    ).toHaveCount(0);
    await district.press("ArrowDown");
    await district.press("Enter");
    await expect(district).toHaveValue("Quận Hải Châu");
    await ward.fill("hai chau");
    await ward.press("ArrowDown");
    await ward.press("Enter");
    await expect(ward).toHaveValue("Phường Hải Châu I");
  });
}

test("late district responses cannot replace suggestions for a newly selected province", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/locations/provinces/1/districts", async (route) => {
    await gate;
    await route.fulfill({
      json: { success: true, data: districtCatalogs["1"] },
    });
  });
  await openRegistration(page);
  const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  // The exact province name already selects the catalog entry while typing.
  const pending = page.waitForRequest("**/api/locations/provinces/1/districts");
  await province.fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
  await pending;
  await province.fill("da nang");
  await page
    .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
    .click();
  const district = page.getByRole("combobox", { name: "Quận / huyện" });
  await district.fill("hai chau");
  await expect(
    page.getByRole("option", { name: "Quận Hải Châu", exact: true }),
  ).toBeVisible();
  const lateResponse = page.waitForResponse(
    "**/api/locations/provinces/1/districts",
  );
  release();
  await lateResponse;
  await expect(
    page.getByRole("option", { name: "Quận Hải Châu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Quận Ba Đình", exact: true }),
  ).toHaveCount(0);
});

test("ward API failure permits manual entry and retry preserves it on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let calls = 0;
  await page.route("**/api/locations/districts/1/wards", (route) =>
    route.fulfill(
      ++calls === 1
        ? {
            status: 503,
            json: {
              success: false,
              errorCode: "SERVICE_UNAVAILABLE",
              data: null,
            },
          }
        : { json: { success: true, data: wardCatalogs["1"] } },
    ),
  );
  await openRegistration(page);
  await page.getByRole("combobox", { name: "Tỉnh / thành phố" }).fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Quận / huyện" }).fill("ba dinh");
  await page.getByRole("option", { name: "Quận Ba Đình", exact: true }).click();
  const ward = page.getByRole("combobox", { name: "Phường / xã" });
  await expect(page.getByText(/Chưa tải được gợi ý phường\/xã/)).toBeVisible();
  await ward.fill("Phường nhập tay");
  await page
    .getByRole("button", { name: "Tải lại danh sách phường/xã" })
    .click();
  await expect(
    page.getByText(/Nhập hoặc chọn phường\/xã thuộc quận\/huyện/),
  ).toBeVisible();
  await expect(ward).toHaveValue("Phường nhập tay");
  await ward.fill("dien bien");
  await page
    .getByRole("option", { name: "Phường Điện Biên", exact: true })
    .click();
  await expect(ward).toHaveValue("Phường Điện Biên");
  expect(calls).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/address-v2-mobile.png",
    fullPage: true,
  });
});

for (const [route, label] of [
  ["/restaurant/register", "Tỉnh / thành phố"],
] as const) {
  test(`province suggestions use the public catalog at ${route}`, async ({
    page,
  }) => {
    await openRegistration(page);
    const field = page.getByRole("combobox", { name: label });
    await field.fill("dien bien");
    await expect(
      page.getByRole("option", { name: "Tỉnh Điện Biên", exact: true }),
    ).toBeVisible();
    await field.press("Enter");
    await expect(field).toHaveValue("Tỉnh Điện Biên");
    await expect(field).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(new RegExp(route.split("?")[0]));
    await field.fill("da nang");
    await page
      .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
      .click();
    await expect(field).toHaveValue("Thành phố Đà Nẵng");
  });
}

test("province choices fit the mobile form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRegistration(page);
  const field = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  await field.fill("");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({
    path: "artifacts/province-picker-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("option", { name: "Tỉnh Lâm Đồng", exact: true })
    .click();
  await expect(field).toHaveValue("Tỉnh Lâm Đồng");
});
