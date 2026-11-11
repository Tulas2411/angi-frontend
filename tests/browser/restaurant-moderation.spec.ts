import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-56 Moderate Restaurant: MOD-R1..MOD-R4 and MOD-RP4 against a stub shaped like the DTOs. */
let calls: string[] = [];
let moderationStatus = "visible";

const card = () => ({
  id: 7,
  name: "Bún Bò Bà Diệu",
  slug: "bun-bo-ba-dieu",
  coverUrl: null,
  addressLine: "12 Lê Duẩn",
  ward: "Phường Hải Châu",
  provinceName: "Thành phố Đà Nẵng",
  latitude: 16.067812,
  longitude: 108.220116,
  priceLevel: 1,
  ratingAvg: 4.6,
  ratingCount: 213,
  operatingStatus: "open",
  isOpenNow: true,
  distanceKm: null,
  verificationStatus: "verified",
  moderationStatus,
  pendingReportCount: 1,
});
const report = {
  id: 88,
  targetType: "restaurant",
  targetId: 7,
  targetName: "Bún Bò Bà Diệu",
  reasonCode: "hygiene",
  description: "Bát đũa bẩn",
  evidenceUrls: [],
  reporter: { id: 12, displayName: "Nguyễn An", avatarUrl: null },
  status: "pending",
  handledBy: null,
  handledAt: null,
  resolutionAction: null,
  resolutionNote: null,
  reportCountOnTarget: 1,
  createdAt: "2026-10-14T01:00:00Z",
};
const detail = () => ({
  ...card(),
  description: "Quán bún bò gia truyền 30 năm",
  phone: "0236 3812 345",
  email: null,
  website: null,
  images: [],
  imageMediaIds: [],
  businessHours: [],
  menu: null,
  myReview: null,
  latestVerification: null,
  openMenuSubmission: null,
  createdAt: "2026-09-25T02:00:00Z",
  updatedAt: "2026-10-01T09:00:00Z",
  owner: {
    id: 12,
    email: "an.nguyen@gmail.com",
    displayName: "Nguyễn An",
    avatarUrl: null,
    role: "RESTAURANT_OWNER",
    status: "active",
    suspendedUntil: null,
    lastLoginAt: null,
    createdAt: "2026-09-20T03:00:00Z",
  },
  dishes: [
    {
      id: 105,
      name: "Bún bò Huế",
      price: 45000,
      coverUrl: null,
      dishForm: "soup",
      isAvailable: true,
      likeCount: 128,
      dislikeCount: 9,
      tags: [],
      restaurant: { id: 7, name: "Bún Bò Bà Diệu" },
      rank: null,
      status: "active",
      sortOrder: 1,
    },
  ],
  reports: [report],
  recentAudit: [],
});

const handler: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/mod/restaurants") {
    calls.push(`MOD-R1 ${parsed.search.slice(1)}`);
    send(200, {
      items: [card()],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/mod/restaurants/7") {
    calls.push("MOD-R2 7");
    send(200, detail());
    return true;
  }
  if (
    method === "PUT" &&
    path === "/api/v1/mod/restaurants/7/moderation-status"
  ) {
    calls.push(`MOD-R3 ${JSON.stringify(body)}`);
    moderationStatus = (body as { moderationStatus: string }).moderationStatus;
    send(200, { restaurantId: 7, moderationStatus });
    return true;
  }
  if (method === "PUT" && path === "/api/v1/mod/dishes/105/moderation-status") {
    calls.push(`MOD-R4 ${JSON.stringify(body)}`);
    send(200, { dishId: 105, status: "hidden" });
    return true;
  }
  if (method === "POST" && path === "/api/v1/mod/reports/88/resolve") {
    calls.push(`MOD-RP4 ${JSON.stringify(body)}`);
    send(200, { ...report, status: "dismissed" });
    return true;
  }
  return false;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, handler);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(() => {
  stub.reset();
  calls = [];
  moderationStatus = "visible";
});

async function open(page: Page, path = "/moderation/restaurants") {
  await loginAs(page, "mod");
  await page.goto(path);
}

test("the list shows restaurants with their moderation state (MOD-R1)", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Kiểm duyệt nhà hàng", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Bún Bò Bà Diệu")).toBeVisible();
  await page.getByRole("button", { name: "Bị ẩn" }).click();
  await expect
    .poll(() => calls.at(-1))
    .toBe("MOD-R1 moderationStatus=hidden&page=1&pageSize=20");
});

test("hiding needs a reason and sends MOD-R3", async ({ page }) => {
  await open(page, "/moderation/restaurants/7");
  await page.getByRole("radio", { name: /Ẩn quán/ }).check();
  await page.getByRole("button", { name: "Ẩn quán" }).click();
  await expect(
    page.getByText("Ghi lý do để chủ quán và các Mod khác biết vì sao."),
  ).toBeVisible();
  await page.getByLabel(/^Lý do/).fill("Nhiều báo cáo về vệ sinh");
  await page.getByRole("button", { name: "Ẩn quán" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ẩn quán" })
    .click();
  await expect(page.getByText(/Chủ quán đã nhận thông báo/)).toBeVisible();
  expect(calls).toContain(
    'MOD-R3 {"moderationStatus":"hidden","reason":"Nhiều báo cáo về vệ sinh"}',
  );
});

test("a dish is hidden with MOD-R4 and a report dismissed with MOD-RP4", async ({
  page,
}) => {
  await open(page, "/moderation/restaurants/7");
  await page.getByRole("button", { name: /Thực đơn/ }).click();
  await page.getByRole("button", { name: /Ẩn món/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Lý do/).fill("Ảnh món không đúng thực tế");
  await dialog.getByRole("button", { name: "Ẩn món" }).click();
  await expect(page.getByText(/Đã ẩn món Bún bò Huế/)).toBeVisible();
  await page.getByRole("button", { name: /Báo cáo \(1\)/ }).click();
  await page.getByRole("button", { name: "Xử lý báo cáo" }).click();
  await page.getByRole("radio", { name: /Bác bỏ/ }).check();
  await page.getByRole("button", { name: "Bác bỏ báo cáo" }).click();
  await expect
    .poll(() => calls.some((c) => c.startsWith("MOD-RP4")))
    .toBe(true);
  expect(calls).toContain(
    'MOD-R4 {"status":"hidden","reason":"Ảnh món không đúng thực tế"}',
  );
});

test("the list and the detail fit from 320px to 1440px", async ({ page }) => {
  for (const path of ["/moderation/restaurants", "/moderation/restaurants/7"]) {
    await open(page, path);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} ${width}px`,
      ).toBe(true);
    }
  }
});
