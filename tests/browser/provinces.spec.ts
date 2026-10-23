import { expect, test } from "@playwright/test";
import { stubMapboxRendering } from "./mapbox-fixture";
import { stubWardCatalogs, wardCatalogs } from "./locations-fixture";
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
  test(`wards follow the selected province without a district at ${route}`, async ({
    page,
  }) => {
    await openRegistration(page);
    await expect(page.getByLabel("Quận / huyện")).toHaveCount(0);
    const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
    const ward = page.getByRole("combobox", { name: "Phường / xã" });
    await province.fill("ha noi");
    await page
      .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
      .click();
    await ward.fill("ba dinh");
    await page
      .getByRole("option", { name: "Phường Ba Đình", exact: true })
      .click();
    await expect(ward).toHaveValue("Phường Ba Đình");
    await province.fill("da nang");
    await page
      .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
      .click();
    await expect(ward).toHaveValue("");
    await ward.fill("hai chau");
    await expect(
      page.getByRole("option", { name: "Phường Ba Đình", exact: true }),
    ).toHaveCount(0);
    await ward.press("ArrowDown");
    await ward.press("Enter");
    await expect(ward).toHaveValue("Phường Hải Châu");
  });
}

test("late ward responses cannot replace suggestions for a newly selected province", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/locations/provinces/1/wards", async (route) => {
    await gate;
    await route.fulfill({ json: { success: true, data: wardCatalogs["1"] } });
  });
  await openRegistration(page);
  const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  // The exact province name already selects the catalog entry while typing.
  const pending = page.waitForRequest("**/api/locations/provinces/1/wards");
  await province.fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
  await pending;
  await province.fill("da nang");
  await page
    .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
    .click();
  const ward = page.getByRole("combobox", { name: "Phường / xã" });
  await ward.fill("hai chau");
  await expect(
    page.getByRole("option", { name: "Phường Hải Châu", exact: true }),
  ).toBeVisible();
  const lateResponse = page.waitForResponse(
    "**/api/locations/provinces/1/wards",
  );
  release();
  await lateResponse;
  await expect(
    page.getByRole("option", { name: "Phường Hải Châu", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Phường Ba Đình", exact: true }),
  ).toHaveCount(0);
});

test("ward API failure permits manual entry and retry preserves it on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let calls = 0;
  await page.route("**/api/locations/provinces/1/wards", (route) =>
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
  const ward = page.getByRole("combobox", { name: "Phường / xã" });
  await expect(page.getByText(/Chưa tải được gợi ý phường\/xã/)).toBeVisible();
  await ward.fill("Phường nhập tay");
  await page
    .getByRole("button", { name: "Tải lại danh sách phường/xã" })
    .click();
  await expect(
    page.getByText(/Nhập hoặc chọn phường\/xã trực thuộc/),
  ).toBeVisible();
  await expect(ward).toHaveValue("Phường nhập tay");
  await ward.fill("ba dinh");
  await page
    .getByRole("option", { name: "Phường Ba Đình", exact: true })
    .click();
  await expect(ward).toHaveValue("Phường Ba Đình");
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
