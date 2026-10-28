import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  CreateRoadmapRequestDto,
  RoadmapDetailDto,
} from "../../src/features/roadmaps/roadmap-types";
import { homeRoadmapDraftKey } from "../../src/features/discovery/home-roadmap-rules";
import { addDays } from "../../src/features/roadmaps/roadmap-rules";

let stub: AccountStub;
let creates: CreateRoadmapRequestDto[] = [];
let current: RoadmapDetailDto | null = null;
let failure: {
  status: number;
  code: string;
  fields?: Record<string, string[]>;
} | null = null;
function detail(body: CreateRoadmapRequestDto): RoadmapDetailDto {
  return {
    overview: {
      id: 88,
      title: body.title,
      startDate: body.startDate ?? null,
      endDate: body.startDate
        ? addDays(body.startDate, body.numDays - 1)
        : null,
      numDays: body.numDays,
      budgetAmount: null,
      totalEstimatedCost: 0,
      itemCount: 0,
      coverUrl: null,
      originMode: "none",
      originLatitude: null,
      originLongitude: null,
      originLabel: null,
      createdAt: "2026-10-28T02:00:00Z",
      updatedAt: "2026-10-28T02:00:00Z",
    },
    itinerary: Array.from({ length: body.numDays }, (_, index) => ({
      dayId: 301 + index,
      dayNumber: index + 1,
      date: body.startDate ? addDays(body.startDate, index) : null,
      note: null,
      dayCost: 0,
      items: [],
    })),
    budget: {
      budgetAmount: null,
      totalEstimatedCost: 0,
      remaining: null,
      isOverBudget: false,
      byDay: [],
      byMealSlot: [],
    },
  };
}
const handler: StubHandler = ({ method, url, body }, send) => {
  if (method === "POST" && url === "/api/v1/roadmaps") {
    creates.push(body as CreateRoadmapRequestDto);
    if (failure) send(failure.status, null, failure.code, failure.fields);
    else {
      current = detail(body as CreateRoadmapRequestDto);
      send(201, current);
    }
    return true;
  }
  if (method === "GET" && url === "/api/v1/roadmaps/88") {
    send(200, current);
    return true;
  }
  return false;
};
test.beforeAll(async () => {
  stub = await startAccountStub(5164, handler);
});
test.afterAll(async () => stopAccountStub(stub));
test.beforeEach(async ({ page, context }) => {
  stub.reset();
  creates = [];
  current = null;
  failure = null;
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/locations/provinces")
      return route.fulfill({
        json: {
          success: true,
          data: [
            { code: 1, name: "Thành phố Hà Nội" },
            { code: 48, name: "Thành phố Đà Nẵng" },
          ],
        },
      });
    return ["localhost", "127.0.0.1"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});
const form = (page: Page) =>
  page.getByRole("form", { name: "Tạo lộ trình nhanh" });
async function fill(page: Page) {
  await form(page)
    .getByRole("combobox", { name: "Tỉnh / thành phố" })
    .fill("Đà Nẵng");
  await page
    .getByRole("option", { name: "Thành phố Đà Nẵng", exact: true })
    .click();
  await form(page).getByLabel("Ngày bắt đầu").fill("2026-11-06");
  await form(page).getByLabel("Số ngày").fill("3");
}

test("the three-field planner leads the homepage and the original hero follows it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Chuyến đi ngon,bắt đầu từ đây.",
  );
  await expect(form(page).locator("input")).toHaveCount(3);
  const first = await page.locator("#tao-lo-trinh").boundingBox();
  const hero = await page.locator(".home-hero").boundingBox();
  expect(first!.y).toBeLessThan(hero!.y);
  await expect(page.locator(".home-hero h2")).toContainText("Ăn đúng gu.");
  expect(creates).toEqual([]);
});

test("validation focuses the missing fields and rejects dates and day counts without a write", async ({
  page,
}) => {
  await page.goto("/");
  await form(page).getByRole("button", { name: "Tạo lộ trình ngay" }).click();
  await expect(form(page).getByRole("combobox")).toBeFocused();
  await expect(
    form(page).getByText("Chọn ngày bắt đầu chuyến đi."),
  ).toBeVisible();
  await fill(page);
  await form(page).getByLabel("Số ngày").fill("8");
  await form(page).getByRole("button", { name: "Tạo lộ trình ngay" }).click();
  await expect(
    form(page).getByText("Số ngày phải là số nguyên từ 1 đến 7."),
  ).toBeVisible();
  expect(creates).toEqual([]);
});

test("a guest draft survives login and creates only after explicit submission as a Traveler", async ({
  page,
}) => {
  await page.goto("/");
  await fill(page);
  await form(page).getByRole("button", { name: "Tạo lộ trình ngay" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(creates).toEqual([]);
  await page.getByLabel(/^Email/).fill("traveler@test.local");
  await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(form(page).getByRole("combobox")).toHaveValue(
    "Thành phố Đà Nẵng",
  );
  await expect(form(page).getByLabel("Ngày bắt đầu")).toHaveValue("2026-11-06");
  expect(creates).toEqual([]);
  await form(page).getByRole("button", { name: "Tạo lộ trình ngay" }).click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  expect(creates).toEqual([
    {
      title: "3 ngày ăn ngon Đà Nẵng",
      startDate: "2026-11-06",
      numDays: 3,
      originMode: "none",
    },
  ]);
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      homeRoadmapDraftKey,
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("angi:roadmap-destination:88"),
    ),
  ).toBe("Thành phố Đà Nẵng");
  expect(
    stub.calls.some((call) => /\/generate|\/days\/\d+\/route/.test(call)),
  ).toBe(false);
});

test("a signed-in Traveler creates once and failure preserves the three fields", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/");
  await fill(page);
  failure = { status: 503, code: "SERVICE_UNAVAILABLE" };
  await form(page).getByRole("button", { name: "Tạo lộ trình ngay" }).click();
  await expect(form(page).getByRole("alert")).toBeVisible();
  await expect(form(page).getByRole("combobox")).toHaveValue(
    "Thành phố Đà Nẵng",
  );
  await expect(form(page).getByLabel("Số ngày")).toHaveValue("3");
  failure = null;
  await form(page)
    .getByRole("button", { name: "Tạo lộ trình ngay" })
    .dblclick();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  expect(creates).toHaveLength(2);
  expect(creates[1]).toEqual(creates[0]);
});

test("structured backend validation is attached to the actual date/day fields", async ({
  page,
}) => {
  await loginAs(page, "traveler");
  await page.goto("/");
  await fill(page);
  failure = {
    status: 400,
    code: "VALIDATION_FAILED",
    fields: {
      NumDays: ["Số ngày cần được kiểm tra lại."],
      StartDate: ["Ngày bắt đầu cần được kiểm tra lại."],
    },
  };
  await form(page).getByRole("button", { name: "Tạo lộ trình ngay" }).click();
  await expect(form(page).getByLabel("Số ngày")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    form(page).getByText("Ngày bắt đầu cần được kiểm tra lại."),
  ).toBeVisible();
});

test("other signed-in roles cannot submit a Traveler roadmap from the homepage", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    headers: { Origin: "http://localhost:3001" },
    data: { email: "mod@test.local", password: "TestPassword123" },
  });
  await page.goto("/");
  await expect(
    form(page).getByRole("button", { name: "Tạo lộ trình ngay" }),
  ).toBeDisabled();
  await expect(form(page)).toContainText(
    "Tạo lộ trình dành cho tài khoản Người khám phá.",
  );
  expect(creates).toEqual([]);
});

test("province suggestions can fail while manual entry and the rest of the homepage remain usable", async ({
  page,
}) => {
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, errorCode: "SERVICE_UNAVAILABLE", data: null },
    }),
  );
  await page.goto("/");
  await expect(
    form(page).getByText(
      "Chưa tải được gợi ý tỉnh/thành. Bạn có thể nhập tên đầy đủ.",
    ),
  ).toBeVisible();
  await form(page).getByRole("combobox").fill("Thành phố Đà Nẵng");
  await expect(form(page).getByRole("combobox")).toHaveValue(
    "Thành phố Đà Nẵng",
  );
  await expect(
    page.getByRole("heading", { name: "Nhìn thôi, đã thấy thèm." }),
  ).toBeVisible();
  expect(creates).toEqual([]);
});

test("the new entry and the moved hero fit desktop and small phones", async ({
  page,
}) => {
  const directory = join(tmpdir(), "angi-home-roadmap-starter");
  await mkdir(directory, { recursive: true });
  await page.goto("/");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      form(page).getByRole("button", { name: "Tạo lộ trình ngay" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: join(directory, `home-roadmap-${width}.png`),
    });
  }
});
