import { stubMapboxRendering } from "./mapbox-fixture";
import {
  openRegistration,
  startOwnerApiStub,
  stopServer,
} from "./owner-api-stub";
import type { Server } from "node:http";
import { expect, test, type Locator } from "@playwright/test";

async function pinPoint(pin: Locator) {
  const box = await pin.boundingBox();
  if (!box) throw new Error("Selected pin must be visible.");
  return { x: box.x + box.width / 2, y: box.y + box.height };
}

let api: Server;
test.beforeAll(async () => {
  api = await startOwnerApiStub();
});
test.afterAll(async () => {
  await stopServer(api);
});
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

test("wheel zoom and mouse drag move the map without changing the saved selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await openRegistration(page);
  const opener = page.getByRole("button", { name: "Chọn vị trí trên bản đồ" });
  await opener.click();
  const dialog = page.getByRole("dialog");
  // A saved location makes the next dialog open with a selected pin.
  await dialog
    .getByRole("button", { name: "Nhập tọa độ", exact: true })
    .click();
  await dialog.getByLabel("Vĩ độ").fill("21.0285");
  await dialog.getByLabel("Kinh độ").fill("105.8542");
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /vị trí.*bản đồ/i }).click();
  const map = dialog.getByRole("application", {
    name: "Bản đồ chọn vị trí nhà hàng",
  });
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
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).hover();
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
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();

  // A deliberate click after dragging still selects a new point.
  await opener.click();
  await expect(map).toHaveAttribute("aria-busy", "false");
  await canvas.click({
    position: { x: bounds.width * 0.7, y: bounds.height * 0.6 },
  });
  await expect(summary).not.toHaveText(selectedText);
  await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toHaveCount(0);
  expect(errors).toEqual([]);
});
