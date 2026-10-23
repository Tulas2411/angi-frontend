import { stubMapboxRendering } from "./mapbox-fixture";
import { expect, test, type Locator } from "@playwright/test";

async function pinPoint(pin: Locator) {
  const box = await pin.boundingBox();
  if (!box) throw new Error("Selected pin must be visible.");
  return { x: box.x + box.width / 2, y: box.y + box.height };
}

test.beforeEach(async ({ page }) => {
  await stubMapboxRendering(page);
  await page.route("https://api.mapbox.com/search/geocode/**", (route) => {
    expect(new URL(route.request().url()).searchParams.get("permanent")).toBe(
      "true",
    );
    return route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [108.2022, 16.0544] },
            properties: { full_address: "Đà Nẵng" },
          },
        ],
      },
    });
  });
});

test("gallery and itinerary pickers use Mapbox search, coordinates and geolocation", async ({
  page,
  context,
}) => {
  await page.goto("/dev/components");
  await page
    .getByRole("button", { name: "Chọn vị trí trên bản đồ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("application", {
      name: "Bản đồ chọn địa điểm",
      exact: true,
    }),
  ).toHaveAttribute("aria-busy", "false");
  await dialog.getByLabel("Tìm địa chỉ hoặc địa điểm").fill("Đà Nẵng");
  await dialog.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await dialog.getByRole("button", { name: "Đà Nẵng", exact: true }).click();
  await expect(
    dialog.getByRole("region", {
      name: "Thông tin địa điểm đã chọn",
      exact: true,
    }),
  ).toContainText("16.05440° N, 108.20220° E");
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.0303, longitude: 105.852 });
  await page.goto("/demo/traveler/roadmaps/new");
  await page.getByRole("button", { name: /Chọn.*bản đồ/ }).click();
  await dialog.getByRole("button", { name: "Dùng vị trí hiện tại" }).click();
  await expect(
    dialog.getByRole("region", {
      name: "Thông tin địa điểm đã chọn",
      exact: true,
    }),
  ).toContainText("21.03030° N, 105.85200° E");
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByLabel("Ăn ở đâu?")).toHaveValue("Vị trí hiện tại");
});

test("itinerary map uses real Mapbox URLs and marker layer/zoom controls", async ({
  page,
}) => {
  await page.goto("/demo/traveler/roadmaps/ha-noi");
  const map = page.getByRole("complementary", {
    name: "Bản đồ lịch ăn",
    exact: true,
  });
  const image = map.getByRole("img", {
    name: "Bản đồ Mapbox các địa điểm trong lịch ăn",
    exact: true,
  });
  await expect(image).toHaveAttribute(
    "src",
    /api\.mapbox\.com\/styles\/.*pin-s/,
  );
  await map.getByRole("button", { name: "Phóng to bản đồ" }).click();
  await expect(image).toHaveAttribute("src", /,14\//);
  await map.getByText("Lớp bản đồ", { exact: true }).click();
  await map
    .getByRole("checkbox", { name: "Lịch ăn uống", exact: true })
    .uncheck();
  await expect(image).not.toHaveAttribute("src", /pin-s/);
  await map
    .getByRole("checkbox", { name: "Lịch ăn uống", exact: true })
    .check();
  await expect(image).toHaveAttribute("src", /pin-s/);
  await map.getByText("Lớp bản đồ", { exact: true }).click();
  await map.getByRole("button", { name: "Xem toàn bộ địa điểm" }).click();
  await page.screenshot({
    path: "artifacts/mapbox-itinerary-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await map.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute("src", /\/390x420\?/);
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (element) =>
          (element as HTMLImageElement).complete &&
          (element as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);
  await map.screenshot({ path: "artifacts/mapbox-itinerary-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("wheel zoom and mouse drag move the map without changing the saved selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/dev/scenarios?state=owner-register-restaurant");
  const opener = page.getByRole("button", { name: "Chọn vị trí trên bản đồ" });
  await opener.click();
  const dialog = page.getByRole("dialog");
  const map = dialog.getByRole("application", { name: "Bản đồ chọn địa điểm" });
  await expect(map).toHaveAttribute("aria-busy", "false");
  const canvas = map.locator("canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Map canvas must be visible.");
  const pin = dialog.getByRole("button", {
    name: "Hiển thị thông tin vị trí đã chọn",
  });
  const summary = dialog.getByRole("region", {
    name: "Thông tin địa điểm đã chọn",
    exact: true,
  });
  const selectedText = (await summary.textContent()) ?? "";
  const pointer = {
    x: bounds.x + bounds.width * 0.72,
    y: bounds.y + bounds.height * 0.62,
  };
  const distance = async () => {
    const point = await pinPoint(pin);
    return Math.hypot(point.x - pointer.x, point.y - pointer.y);
  };
  const initialDistance = await distance();
  const pageScroll = await page.evaluate(() => scrollY);
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -320);
  await expect.poll(distance).toBeGreaterThan(initialDistance * 1.25);
  await expect(map).toHaveAttribute("aria-busy", "false");
  const zoomedDistance = await distance();
  await page.mouse.wheel(0, 320);
  await expect.poll(distance).toBeLessThan(zoomedDistance / 1.2);
  await expect(map).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => scrollY)).toBe(pageScroll);

  // Dismissed cards stay dismissed while dragging/zooming; the pin moves with geography.
  await dialog
    .getByRole("button", { name: "Ẩn thông tin điểm trên bản đồ" })
    .click();
  await dialog
    .getByRole("button", { name: "Ẩn thông tin địa điểm đã chọn" })
    .click();
  const beforeDrag = await pinPoint(pin);
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.down();
  await page.mouse.move(pointer.x + 70, pointer.y + 35, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => (await pinPoint(pin)).x - beforeDrag.x)
    .toBeGreaterThan(60);
  await expect(map).toHaveAttribute("aria-busy", "false");
  await expect(summary).toHaveCount(0);
  await expect(
    dialog.getByRole("region", {
      name: "Thông tin điểm trên bản đồ",
      exact: true,
    }),
  ).toHaveCount(0);

  // The wheel also works over a modal control rather than scrolling the page.
  const beforeOverlayWheel = await pinPoint(pin);
  await dialog.getByRole("button", { name: "Lưu", exact: true }).hover();
  await page.mouse.wheel(0, -80);
  await expect
    .poll(async () => {
      const point = await pinPoint(pin);
      return Math.hypot(
        point.x - beforeOverlayWheel.x,
        point.y - beforeOverlayWheel.y,
      );
    })
    .toBeGreaterThan(5);
  await expect(map).toHaveAttribute("aria-busy", "false");
  await expect(summary).toHaveCount(0);
  await pin.click();
  await expect(summary).toHaveText(selectedText);
  await dialog.screenshot({ path: "artifacts/mapbox-gestures-desktop.png" });
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();

  // A deliberate click after dragging still selects a new point.
  await opener.click();
  await expect(map).toHaveAttribute("aria-busy", "false");
  await canvas.click({
    position: { x: bounds.width * 0.7, y: bounds.height * 0.6 },
  });
  await expect(summary).not.toHaveText(selectedText);
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mobile edge selections keep the popup and its close button inside the modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/components");
  await page
    .getByRole("button", { name: "Chọn vị trí trên bản đồ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const map = dialog.getByRole("application", { name: "Bản đồ chọn địa điểm" });
  await expect(map).toHaveAttribute("aria-busy", "false");
  const bounds = await map.boundingBox();
  if (!bounds) throw new Error("Map must have visible bounds.");
  for (const y of [bounds.height / 2, 120]) {
    await map
      .locator("canvas")
      .click({ position: { x: bounds.width - 40, y } });
    const popup = dialog.getByRole("region", {
      name: "Thông tin điểm trên bản đồ",
      exact: true,
    });
    const close = popup.getByRole("button", {
      name: "Ẩn thông tin điểm trên bản đồ",
    });
    await expect(close).toBeVisible();
    const closeBounds = await close.boundingBox();
    if (!closeBounds)
      throw new Error("Popup close button must have visible bounds.");
    expect(closeBounds.x).toBeGreaterThanOrEqual(bounds.x);
    expect(closeBounds.x + closeBounds.width).toBeLessThanOrEqual(
      bounds.x + bounds.width,
    );
    expect(closeBounds.y).toBeGreaterThanOrEqual(bounds.y);
    await close.click();
    await expect(popup).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Hiển thị thông tin vị trí đã chọn" }),
    ).toBeVisible();
  }
  await dialog.screenshot({ path: "artifacts/mapbox-gestures-mobile.png" });
});
