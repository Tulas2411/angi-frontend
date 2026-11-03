import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-59 Handle Restaurant Report: MOD-RP1..MOD-RP4 against a stub shaped like the DTOs. */
let calls: string[] = [];
let status = "pending";
let handledBy: { id: number; displayName: string; avatarUrl: null } | null =
  null;

const report = () => ({
  id: 88,
  targetType: "restaurant",
  targetId: 7,
  targetName: "Bún Bò Bà Diệu",
  reasonCode: "hygiene",
  description: "Bát đũa bẩn",
  evidenceUrls: [],
  reporter: { id: 12, displayName: "Nguyễn An", avatarUrl: null },
  status,
  handledBy,
  handledAt: handledBy ? "2026-11-03T02:00:00Z" : null,
  resolutionAction: null,
  resolutionNote: null,
  reportCountOnTarget: 2,
  createdAt: "2026-10-14T01:00:00Z",
});
const target = {
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
};

const handler: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/mod/reports") {
    calls.push(`MOD-RP1 ${parsed.search.slice(1)}`);
    const items =
      parsed.searchParams.get("targetType") === "restaurant" ? [report()] : [];
    send(200, {
      items,
      page: 1,
      pageSize: 20,
      totalItems: items.length,
      totalPages: items.length ? 1 : 0,
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/mod/reports/88") {
    calls.push("MOD-RP2 88");
    send(200, {
      ...report(),
      target,
      relatedReports: [
        {
          ...report(),
          id: 89,
          reasonCode: "wrong_info",
          status: "pending",
          handledBy: null,
        },
      ],
    });
    return true;
  }
  if (method === "POST" && path === "/api/v1/mod/reports/88/claim") {
    calls.push("MOD-RP3 88");
    status = "in_review";
    handledBy = { id: 1, displayName: "Mod", avatarUrl: null };
    send(200, report());
    return true;
  }
  if (method === "POST" && path === "/api/v1/mod/reports/88/resolve") {
    calls.push(`MOD-RP4 ${JSON.stringify(body)}`);
    const request = body as { outcome: string; resolutionAction: string };
    status = request.outcome;
    send(200, { ...report(), resolutionAction: request.resolutionAction });
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
  status = "pending";
  handledBy = null;
});

async function open(page: Page, path = "/moderation/reports") {
  await loginAs(page, "mod");
  await page.goto(path);
}

test("the queue lists pending restaurant reports and claims one (MOD-RP1, MOD-RP3)", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Báo cáo vi phạm", level: 1 }),
  ).toBeVisible();
  expect(calls[0]).toBe(
    "MOD-RP1 targetType=restaurant&status=pending&page=1&pageSize=20",
  );
  await page.getByRole("button", { name: "Nhận xử lý" }).click();
  await expect(page.getByText(/Đã nhận xử lý báo cáo #88/)).toBeVisible();
  expect(calls).toContain("MOD-RP3 88");
});

test("the handling page shows the restaurant and the related reports (MOD-RP2)", async ({
  page,
}) => {
  await open(page, "/moderation/reports/88");
  await expect(
    page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Bát đũa bẩn")).toBeVisible();
  await expect(page.getByText("Sai thông tin")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Hồ sơ, thực đơn/ }),
  ).toHaveAttribute("href", "/moderation/restaurants/7");
});

test("a dismissal sends MOD-RP4 with no action", async ({ page }) => {
  await open(page, "/moderation/reports/88");
  await page.getByRole("button", { name: "Nhận xử lý" }).click();
  await page.getByRole("radio", { name: /Bác bỏ/ }).check();
  await page.getByRole("button", { name: "Bác bỏ báo cáo" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bác bỏ báo cáo" })
    .click();
  await expect(page.getByText(/Đã bác bỏ báo cáo/)).toBeVisible();
  expect(calls).toContain(
    'MOD-RP4 {"outcome":"dismissed","resolutionAction":"none","applyToRelatedReports":true}',
  );
});

test("the queue and the handling page fit from 320px to 1440px", async ({
  page,
}) => {
  for (const path of ["/moderation/reports", "/moderation/reports/88"]) {
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
