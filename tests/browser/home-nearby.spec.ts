import { expect, test, type Page } from "@playwright/test";
import type { Server } from "node:http";
import { stubMapboxRendering } from "./mapbox-fixture";
import { startOwnerApiStub, stopServer } from "./owner-api-stub";

let api: Server;
let reverseRequests: URL[] = [];
test.beforeAll(async () => {
  api = await startOwnerApiStub();
});
test.afterAll(async () => {
  await stopServer(api);
});

test.beforeEach(async ({ page }) => {
  reverseRequests = [];
  await stubMapboxRendering(page);
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { code: 1, name: "Thành phố Hà Nội" },
          { code: 48, name: "Thành phố Đà Nẵng" },
        ],
      },
    }),
  );
  // Registered after the rendering stub, so it handles reverse lookups first.
  await page.route(
    "https://api.mapbox.com/search/geocode/v6/reverse**",
    (route) => {
      reverseRequests.push(new URL(route.request().url()));
      return route.fulfill({
        json: {
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [105.8301, 21.0401] },
              properties: {
                feature_type: "locality",
                name: "Ngọc Hà",
                context: {
                  region: { name: "Hà Nội" },
                  country: { country_code: "VN" },
                },
              },
            },
          ],
        },
      });
    },
  );
});

const nearbyTab = (page: Page) =>
  page.getByRole("tab", { name: "Ăn quanh đây" });

test("opening the nearby tab locates the visitor once and links to the dishes of their province", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.04, longitude: 105.83 });
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Lên lịch ăn ngon" }),
  ).toHaveAttribute("aria-selected", "true");
  await nearbyTab(page).click();
  const panel = page.getByRole("tabpanel", { name: "Ăn quanh đây" });
  await expect(panel.getByText("Bạn đang ở", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("Thành phố Hà Nội", { exact: true }),
  ).toBeVisible();
  expect(reverseRequests).toHaveLength(1);
  expect(reverseRequests[0].searchParams.get("latitude")).toBe("21.04");
  expect(reverseRequests[0].searchParams.get("longitude")).toBe("105.83");

  // The found province is kept while the visitor looks at the planner.
  await page.getByRole("tab", { name: "Lên lịch ăn ngon" }).click();
  await expect(
    page.getByRole("form", { name: "Tạo lộ trình nhanh" }),
  ).toBeVisible();
  await nearbyTab(page).click();
  expect(reverseRequests).toHaveLength(1);

  await panel
    .getByRole("link", { name: "Khám phá món ăn ở Thành phố Hà Nội" })
    .click();
  await expect(page).toHaveURL(
    /\/dishes\?province=Th%C3%A0nh\+ph%E1%BB%91\+H%C3%A0\+N%E1%BB%99i$/,
  );
});

test("a denied location explains how to allow it and never calls Mapbox", async ({
  page,
}) => {
  await page.goto("/");
  await nearbyTab(page).click();
  const panel = page.getByRole("tabpanel", { name: "Ăn quanh đây" });
  await expect(panel.getByRole("alert")).toContainText(
    "Bạn chưa cho phép ANGI xem vị trí",
  );
  await expect(panel.getByRole("button", { name: "Thử lại" })).toBeVisible();
  expect(reverseRequests).toHaveLength(0);
});
