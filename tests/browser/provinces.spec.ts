import { expect, test } from "@playwright/test";
import { stubMapboxRendering } from "./mapbox-fixture";
import { stubWardCatalogs, wardCatalogs } from "./locations-fixture";

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

for (const route of [
  "/dev/scenarios?state=owner-register-restaurant",
  "/demo/owner/profile",
]) {
  test(`wards follow the selected province without a district at ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
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
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
  const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  await province.fill("ha noi");
  const pending = page.waitForRequest("**/api/locations/provinces/1/wards");
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
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
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
  ["/dev/scenarios?state=owner-register-restaurant", "Tỉnh / thành phố"],
  ["/demo/owner/profile", "Tỉnh / thành phố"],
  ["/demo/traveler/roadmaps/new", "Ăn ở đâu?"],
  ["/dev/components", "Điểm đến"],
  ["/demo/guest/restaurants", "Tìm theo tên quán hoặc địa điểm"],
] as const) {
  test(`province suggestions use the public catalog at ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
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

test("a failed province API keeps manual input and supports retry without losing it", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/locations/provinces", (route) => {
    calls++;
    return route.fulfill(
      calls === 1
        ? {
            status: 503,
            json: {
              success: false,
              errorCode: "SERVICE_UNAVAILABLE",
              data: null,
            },
          }
        : { json: { success: true, data: provinces } },
    );
  });
  await page.goto("/demo/traveler/roadmaps/new");
  await expect(page.getByText(/Chưa tải được gợi ý tỉnh\/thành/)).toBeVisible();
  const field = page.getByRole("combobox", { name: "Ăn ở đâu?" });
  await field.fill("Tên tỉnh nhập tay");
  await page
    .getByRole("button", { name: "Tải lại danh sách tỉnh/thành" })
    .click();
  await expect(page.getByText(/Chọn tỉnh\/thành từ gợi ý/)).toBeVisible();
  await expect(field).toHaveValue("Tên tỉnh nhập tay");
  await field.fill("dien bien");
  await page
    .getByRole("option", { name: "Tỉnh Điện Biên", exact: true })
    .click();
  expect(calls).toBe(2);
  const header = page.getByRole("combobox", {
    name: "Tìm địa điểm hoặc nhà hàng",
  });
  await header.fill("da nang");
  await expect(
    page.getByRole("option", { name: "Thành phố Đà Nẵng", exact: true }),
  ).toBeVisible();
});

test("header province selection reaches restaurant results and updates an existing search", async ({
  page,
}) => {
  await page.goto("/demo/guest/restaurants");
  const header = page.getByRole("combobox", {
    name: "Tìm địa điểm hoặc nhà hàng",
  });
  const results = page.getByRole("combobox", {
    name: "Tìm theo tên quán hoặc địa điểm",
  });
  await header.fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
  await header.press("Enter");
  await expect(results).toHaveValue("Thành phố Hà Nội");
  await expect(
    page.getByRole("heading", { name: "Bếp Nhà", exact: true }),
  ).toBeVisible();
  await header.fill("da nang");
  await page
    .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
    .click();
  await header.press("Enter");
  await expect(results).toHaveValue("Thành phố Đà Nẵng");
  await expect(
    page.getByRole("heading", { name: "Không có kết quả", exact: true }),
  ).toBeVisible();
});

test("map search shares the catalog and Escape dismisses suggestions before the modal", async ({
  page,
}) => {
  let catalogCalls = 0;
  let mapboxSearches = 0;
  await page.route("**/api/locations/provinces", (route) => {
    catalogCalls++;
    return route.fulfill({ json: { success: true, data: provinces } });
  });
  await page.route("https://api.mapbox.com/search/geocode/**", (route) => {
    mapboxSearches++;
    return route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [108.2022, 16.0544] },
            properties: { full_address: "Thành phố Đà Nẵng" },
          },
        ],
      },
    });
  });
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
  await expect(page.getByText("Đang tải danh sách tỉnh/thành…")).toHaveCount(0);
  const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  await province.fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
  await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  const dialog = page.getByRole("dialog");
  const search = dialog.getByRole("combobox", {
    name: "Tìm địa chỉ hoặc địa điểm",
  });
  await search.fill("da nang");
  await expect(
    dialog.getByRole("option", { name: "Thành phố Đà Nẵng", exact: true }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await search.press("ArrowDown");
  await expect(
    dialog.getByRole("option", { name: "Thành phố Đà Nẵng", exact: true }),
  ).toBeVisible();
  await search.press("Enter");
  await expect(search).toHaveValue("Thành phố Đà Nẵng");
  expect(mapboxSearches).toBe(0);
  await dialog.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Thành phố Đà Nẵng", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", {
      name: "Thông tin địa điểm đã chọn",
      exact: true,
    }),
  ).toContainText("16.05440° N, 108.20220° E");
  expect(mapboxSearches).toBe(1);
  expect(catalogCalls).toBe(1);
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(province).toHaveValue("Thành phố Hà Nội");
});

test("province choices fit the mobile form", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
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

test("long province lists scroll with keyboard and wheel without zooming the map", async ({
  page,
}) => {
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: Array.from({ length: 40 }, (_, index) => ({
          name: `Tỉnh thử nghiệm ${String(index).padStart(2, "0")}`,
          code: index + 1,
        })),
      },
    }),
  );
  await page.goto("/dev/components");
  await page
    .getByRole("button", { name: "Chọn vị trí trên bản đồ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("application")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const search = dialog.getByRole("combobox", {
    name: "Tìm địa chỉ hoặc địa điểm",
  });
  await search.fill("");
  const list = dialog.getByRole("listbox");
  await expect(list.getByRole("option")).toHaveCount(40);
  for (let index = 0; index < 20; index++) await search.press("ArrowDown");
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  const activeId = await search.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  const listBounds = await list.boundingBox();
  const activeBounds = await active.boundingBox();
  if (!listBounds || !activeBounds)
    throw new Error("Province list and active option must be visible.");
  expect(activeBounds.y).toBeGreaterThanOrEqual(listBounds.y);
  expect(activeBounds.y + activeBounds.height).toBeLessThanOrEqual(
    listBounds.y + listBounds.height,
  );
  const pin = dialog.getByRole("button", {
    name: "Hiển thị thông tin vị trí đã chọn",
  });
  const before = await pin.boundingBox();
  const scrollBefore = await list.evaluate((element) => element.scrollTop);
  await list.hover();
  await page.mouse.wheel(0, 200);
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(scrollBefore);
  expect(await pin.boundingBox()).toEqual(before);
});
