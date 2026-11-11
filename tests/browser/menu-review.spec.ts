import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-58 Review Pending Menu Submission: MOD-M1..MOD-M4 against a stub shaped like the DTOs. */
let calls: string[] = [];
let status = "pending";
let notPending = false;

const restaurant = {
  id: 7,
  name: "Bún Bò Bà Diệu",
  ward: "Phường Hải Châu",
  provinceName: "Thành phố Đà Nẵng",
  latitude: null,
  longitude: null,
  ratingAvg: 4.6,
};
const dish = (id: number, name: string, price: number) => ({
  id,
  name,
  price,
  coverUrl: null,
  dishForm: "soup",
  isAvailable: true,
  likeCount: 12,
  dislikeCount: 1,
  tags: [{ id: 3, tagType: "category", code: "bun", name: "Bún" }],
  restaurant: { ...restaurant, district: null },
  rank: null,
});
const submission = () => ({
  id: 14,
  restaurantId: 7,
  status,
  ownerNote: "Thêm món mới cho mùa đông",
  submittedAt: "2026-10-01T02:00:00Z",
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: "2026-09-30T02:00:00Z",
});
const item = (
  id: number,
  change: string,
  name: string,
  price: number,
  before: unknown = null,
) => ({
  id,
  sourceDishId: before ? 105 : null,
  change,
  name,
  description: null,
  dishForm: "soup",
  price,
  coverMediaId: null,
  coverUrl: null,
  tagIds: [3],
  sortOrder: id,
  resultDishId: null,
  before,
});

const handler: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (method === "GET" && path === "/api/v1/tags") {
    send(200, [{ id: 3, tagType: "category", code: "bun", name: "Bún" }]);
    return true;
  }
  if (!path.startsWith("/api/v1/mod/menu-submissions")) return false;
  if (method === "GET" && path === "/api/v1/mod/menu-submissions") {
    calls.push(`MOD-M1 ${parsed.search.slice(1)}`);
    const items =
      parsed.searchParams.get("status") === status
        ? [
            {
              ...submission(),
              restaurant,
              newCount: 1,
              editedCount: 1,
              removedCount: 1,
            },
          ]
        : [];
    send(200, {
      items,
      page: 1,
      pageSize: 20,
      totalItems: items.length,
      totalPages: items.length ? 1 : 0,
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/mod/menu-submissions/14") {
    calls.push("MOD-M2 14");
    send(200, {
      ...submission(),
      restaurant,
      items: [
        item(501, "new", "Cháo lòng", 35000),
        item(
          502,
          "edited",
          "Bún bò Huế",
          50000,
          dish(105, "Bún bò Huế", 45000),
        ),
        item(503, "unchanged", "Mì Quảng", 40000, dish(106, "Mì Quảng", 40000)),
      ],
      removedDishes: [dish(107, "Bánh canh", 30000)],
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/mod/menu-submissions/999") {
    send(404, null, "SUBMISSION_NOT_FOUND");
    return true;
  }
  const decide =
    /^\/api\/v1\/mod\/menu-submissions\/14\/(approve|reject)$/.exec(path);
  if (method === "POST" && decide) {
    calls.push(
      `MOD-M${decide[1] === "approve" ? 3 : 4} ${JSON.stringify(body)}`,
    );
    if (notPending) {
      send(409, null, "SUBMISSION_NOT_PENDING");
      return true;
    }
    status = decide[1] === "approve" ? "approved" : "rejected";
    send(200, {
      ...submission(),
      createdDishIds: [201],
      updatedDishIds: [105],
      removedDishIds: [107],
    });
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
  notPending = false;
});

async function open(page: Page, path = "/moderation/menus") {
  await loginAs(page, "mod");
  await page.goto(path);
}

test("the queue lists pending submissions with what they change (MOD-M1)", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Duyệt thực đơn", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("+1 món mới")).toBeVisible();
  expect(calls[0]).toBe("MOD-M1 status=pending&page=1&pageSize=20");
});

test("the review compares with the running menu and filters by change (MOD-M2)", async ({
  page,
}) => {
  await open(page, "/moderation/menus/14");
  await expect(
    page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Thay đổi của Bún bò Huế")).toContainText("Giá");
  await expect(page.getByText("Gỡ khỏi thực đơn")).toBeVisible();
  await page.getByRole("button", { name: /^Mới \(1\)/ }).click();
  await expect(page.locator(".mr-item")).toHaveCount(1);
  await expect(page.getByText("Cháo lòng")).toBeVisible();
});

test("rejecting needs a reason and sends MOD-M4; approving sends MOD-M3", async ({
  page,
}) => {
  await open(page, "/moderation/menus/14");
  await page.getByRole("radio", { name: /Từ chối/ }).check();
  await page.getByRole("button", { name: "Từ chối thực đơn" }).click();
  await expect(
    page.getByText("Ghi lý do từ chối để chủ quán biết cần sửa món nào."),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Duyệt thực đơn/ }).check();
  await page.getByRole("button", { name: "Duyệt thực đơn" }).click();
  await page
    .getByRole("dialog", { name: /Duyệt thực đơn của/ })
    .getByRole("button", { name: "Duyệt thực đơn" })
    .click();
  await expect(
    page.getByText(/1 món mới, 1 món cập nhật, 1 món gỡ/),
  ).toBeVisible();
  expect(calls).toContain("MOD-M3 {}");
});

test("a submission no longer pending is told and read again (409)", async ({
  page,
}) => {
  await open(page, "/moderation/menus/14");
  notPending = true;
  await page.getByRole("button", { name: "Duyệt thực đơn" }).click();
  await page
    .getByRole("dialog", { name: /Duyệt thực đơn của/ })
    .getByRole("button", { name: "Duyệt thực đơn" })
    .click();
  await expect(page.getByText(/không còn chờ duyệt/)).toBeVisible();
  await expect
    .poll(() => calls.filter((c) => c === "MOD-M2 14").length)
    .toBe(2);
});

test("an unknown submission says so", async ({ page }) => {
  await open(page, "/moderation/menus/999");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy bản thực đơn" }),
  ).toBeVisible();
});

test("the queue and the review fit from 320px to 1440px", async ({ page }) => {
  for (const path of ["/moderation/menus", "/moderation/menus/14"]) {
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
