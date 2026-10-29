import { expect, test, type Page } from "@playwright/test";
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
  UpdateRoadmapRequestDto,
} from "../../src/features/roadmaps/roadmap-types";

/** F-19: RM-01 / RM-04 against a local stub. No Mapbox request is made (empty token). */
const creates: CreateRoadmapRequestDto[] = [];
const patches: UpdateRoadmapRequestDto[] = [];
let failure: {
  status: number;
  errorCode: string;
  errors?: Record<string, string[]>;
} | null = null;
let current: RoadmapDetailDto | null = null;

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** RoadmapDetail shaped like the RM-01 JSON sample of API Design v1.8. */
function detail(
  overview: Partial<RoadmapDetailDto["overview"]> & { numDays: number },
): RoadmapDetailDto {
  const startDate = overview.startDate ?? null;
  const budgetAmount = overview.budgetAmount ?? null;
  return {
    overview: {
      id: 88,
      title: overview.title ?? "",
      startDate,
      endDate: startDate ? addDays(startDate, overview.numDays - 1) : null,
      numDays: overview.numDays,
      budgetAmount,
      totalEstimatedCost: 0,
      itemCount: 0,
      coverUrl: null,
      originMode: overview.originMode ?? "none",
      originLatitude: overview.originLatitude ?? null,
      originLongitude: overview.originLongitude ?? null,
      originLabel: overview.originLabel ?? null,
      createdAt: "2026-10-24T02:00:00Z",
      updatedAt: "2026-10-24T02:00:00Z",
    },
    itinerary: Array.from({ length: overview.numDays }, (_, index) => ({
      dayId: 301 + index,
      dayNumber: index + 1,
      date: startDate ? addDays(startDate, index) : null,
      note: null,
      dayCost: 0,
      items: [],
    })),
    budget: {
      budgetAmount,
      totalEstimatedCost: 0,
      remaining: budgetAmount,
      isOverBudget: false,
      byDay: [],
      byMealSlot: [],
    },
  };
}

const roadmaps: StubHandler = ({ method, url, body }, send) => {
  if (method === "POST" && url === "/api/v1/roadmaps") {
    creates.push(body as CreateRoadmapRequestDto);
    if (failure) send(failure.status, null, failure.errorCode, failure.errors);
    else {
      current = detail(body as CreateRoadmapRequestDto);
      send(201, current);
    }
    return true;
  }
  if (method === "PATCH" && url === "/api/v1/roadmaps/88") {
    const patch = body as UpdateRoadmapRequestDto;
    patches.push(patch);
    if (failure) send(failure.status, null, failure.errorCode, failure.errors);
    else if (current) {
      const merged = { ...current.overview, ...patch };
      if (patch.originMode && patch.originMode !== "pinned")
        Object.assign(merged, {
          originLatitude: null,
          originLongitude: null,
          originLabel: null,
        });
      current = detail(merged);
      send(200, current);
    } else send(404, null, "ROADMAP_NOT_FOUND");
    return true;
  }
  return false;
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, roadmaps);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(async ({ page }) => {
  stub.reset();
  creates.length = 0;
  patches.length = 0;
  failure = null;
  current = null;
  await page.route("**/api/locations/provinces", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { name: "Thành phố Hà Nội", code: 1 },
          { name: "Thành phố Đà Nẵng", code: 48 },
        ],
      },
    }),
  );
  // The planner must never reach a map provider in this suite.
  await page.route(/mapbox\.com/, (route) => route.abort());
});

const submit = (page: Page) =>
  page.getByRole("button", { name: "Tạo lộ trình", exact: true });

async function open(page: Page) {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/new");
  await expect(
    page.getByRole("heading", { name: "Lên lộ trình ăn ngon" }),
  ).toBeVisible();
}

const choice = (page: Page, mode: "pinned" | "gps") =>
  page.locator(`[data-origin-choice="${mode}"]`);

async function chooseProvince(page: Page, name: string) {
  await page.getByLabel(/^Bạn muốn ăn ở đâu\?/).fill(name);
  await page.keyboard.press("Escape");
}

test("only a signed-in Traveler can open the planner; others go to their landing page", async ({
  page,
}) => {
  await page.goto("/roadmaps/new");
  await expect(page).toHaveURL(/\/login$/);
  for (const [role, landing] of [
    ["owner", /\/restaurant$/],
    ["mod", /\/moderation$/],
    ["admin", /\/administration$/],
  ] as const) {
    await loginAs(page, role);
    await page.goto("/roadmaps/new");
    await expect(page).toHaveURL(landing);
  }
  await loginAs(page, "traveler");
  await page.locator("summary").first().click();
  await page
    .locator("header")
    .getByRole("link", { name: "Lập lộ trình mới" })
    .click();
  await expect(page).toHaveURL(/\/roadmaps\/new$/);
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng chính" })
      .getByRole("link", { name: "Lộ trình", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("client validation blocks an incomplete plan without calling RM-01", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel(/^Số ngày/).fill("8");
  await submit(page).click();
  await expect(
    page.getByText("Chọn tỉnh / thành phố bạn muốn đến."),
  ).toBeVisible();
  await expect(page.getByText("Tên lộ trình là bắt buộc.")).toBeVisible();
  await expect(
    page.getByText("Số ngày phải là số nguyên từ 1 đến 7."),
  ).toBeVisible();
  await expect(page.getByLabel(/^Bạn muốn ăn ở đâu\?/)).toBeFocused();
  expect(creates).toEqual([]);
});

test("RM-01 without a location sends the documented body and shows the created roadmap", async ({
  page,
}) => {
  await open(page);
  // Neither choice is pressed: the default `none` origin, province only.
  await expect(choice(page, "pinned")).toHaveAttribute("aria-pressed", "false");
  await expect(choice(page, "gps")).toHaveAttribute("aria-pressed", "false");
  await chooseProvince(page, "Thành phố Hà Nội");
  await page.getByLabel(/^Số ngày/).fill("2");
  // The title follows the destination and the number of days until it is edited.
  await expect(page.getByLabel(/^Tên lộ trình/)).toHaveValue(
    "2 ngày ăn ngon Hà Nội",
  );
  await submit(page).click();
  await expect(
    page.getByRole("heading", { name: "2 ngày ăn ngon Hà Nội" }),
  ).toBeFocused();
  expect(creates).toEqual([
    { title: "2 ngày ăn ngon Hà Nội", numDays: 2, originMode: "none" },
  ]);
  await expect(
    page.getByText("Đã tạo lộ trình với 2 ngày trống."),
  ).toBeVisible();
  const overview = page.locator(".detail-list");
  await expect(overview).toContainText("Chưa chọn ngày đi");
  await expect(overview).toContainText("2 ngày");
  await expect(overview).toContainText("Chưa đặt");
  await expect(overview).toContainText("Chưa có vị trí");
});

test("RM-01 with the current location asks the browser, then sends no coordinates", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.0678, longitude: 108.2208 });
  await open(page);
  await chooseProvince(page, "Thành phố Đà Nẵng");
  await choice(page, "gps").click();
  await expect(choice(page, "gps")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Đã cho phép vị trí/)).toBeVisible();
  await page.getByLabel(/^Ngày bắt đầu/).fill("2026-10-30");
  const budget = page.getByLabel(/^Ngân sách dự kiến/);
  await budget.pressSequentially("1500000");
  await expect(budget).toHaveValue("1.500.000 VND");
  await page.getByLabel(/^Tên lộ trình/).fill("  Đà Nẵng cuối tuần ");
  await expect(page.locator(".roadmap-plan-summary")).toContainText(
    "30 thg 10, 2026 – 1 thg 11, 2026",
  );
  await submit(page).click();
  await expect(
    page.getByRole("heading", { name: "Đà Nẵng cuối tuần" }),
  ).toBeVisible();
  expect(creates).toEqual([
    {
      title: "Đà Nẵng cuối tuần",
      startDate: "2026-10-30",
      numDays: 3,
      budgetAmount: 1500000,
      originMode: "gps",
    },
  ]);
  await expect(page.locator(".detail-list")).toContainText("Vị trí hiện tại");
  await expect(page.locator(".detail-list")).toContainText(
    "1.500.000 VND / người",
  );
});

test("the budget is shown as Vietnamese currency while typing and sends plain digits", async ({
  page,
}) => {
  await open(page);
  const budget = page.getByLabel(/^Ngân sách dự kiến/);
  await budget.pressSequentially("800");
  await expect(budget).toHaveValue("800 VND");
  await budget.pressSequentially("000");
  await expect(budget).toHaveValue("800.000 VND");
  // Letters and symbols are dropped; the unit is always last.
  await budget.pressSequentially("ab,-");
  await expect(budget).toHaveValue("800.000 VND");
  // Backspace removes digits even though the caret sits before the unit.
  await budget.press("Backspace");
  await expect(budget).toHaveValue("80.000 VND");
  // Editing in the middle keeps the grouping and the caret.
  await budget.press("Home");
  await budget.press("ArrowRight");
  await budget.pressSequentially("1");
  await expect(budget).toHaveValue("810.000 VND");
  await budget.fill("");
  await expect(budget).toHaveValue("");
  await budget.fill("2000000");
  await expect(budget).toHaveValue("2.000.000 VND");
  await chooseProvince(page, "Thành phố Hà Nội");
  await submit(page).click();
  await expect(
    page.getByRole("heading", { name: "3 ngày ăn ngon Hà Nội" }),
  ).toBeVisible();
  expect(creates).toEqual([
    {
      title: "3 ngày ăn ngon Hà Nội",
      numDays: 3,
      budgetAmount: 2000000,
      originMode: "none",
    },
  ]);
});

test("a denied location permission keeps the origin unset and explains how to continue", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await open(page);
  await chooseProvince(page, "Thành phố Hà Nội");
  await choice(page, "gps").click();
  await expect(
    page.getByText(/Trình duyệt đang chặn vị trí của trang này/),
  ).toBeVisible();
  await expect(choice(page, "gps")).toHaveAttribute("aria-pressed", "false");
  await submit(page).click();
  await expect(
    page.getByRole("heading", { name: "3 ngày ăn ngon Hà Nội" }),
  ).toBeVisible();
  expect(creates).toEqual([
    { title: "3 ngày ăn ngon Hà Nội", numDays: 3, originMode: "none" },
  ]);
});

test("a VALIDATION_FAILED response keeps the edits and shows the field error", async ({
  page,
}) => {
  await open(page);
  failure = {
    status: 400,
    errorCode: "VALIDATION_FAILED",
    errors: { Title: ["Tên roadmap không được vượt quá 200 ký tự."] },
  };
  await chooseProvince(page, "Thành phố Hà Nội");
  await submit(page).click();
  await expect(
    page.getByText("Tên roadmap không được vượt quá 200 ký tự."),
  ).toBeVisible();
  await expect(page.locator(".alert-error")).toContainText(
    "Vui lòng kiểm tra thông tin đã nhập.",
  );
  await expect(page.getByLabel(/^Bạn muốn ăn ở đâu\?/)).toHaveValue(
    "Thành phố Hà Nội",
  );
  failure = null;
  await submit(page).click();
  await expect(
    page.getByRole("heading", { name: "3 ngày ăn ngon Hà Nội" }),
  ).toBeVisible();
  expect(creates).toHaveLength(2);
});

test("RM-04 sends only the changed fields, reports DAY_NOT_EMPTY and asks before discarding", async ({
  page,
}) => {
  await open(page);
  await chooseProvince(page, "Thành phố Hà Nội");
  await submit(page).click();
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  const save = page.getByRole("button", { name: "Lưu thay đổi" });
  await expect(save).toBeDisabled();
  await expect(page.getByLabel(/^Bạn muốn ăn ở đâu\?/)).toHaveCount(0);

  failure = { status: 409, errorCode: "DAY_NOT_EMPTY" };
  await page.getByLabel(/^Số ngày/).fill("2");
  await save.click();
  await expect(page.locator(".alert-error")).toContainText(
    "Không thể giảm số ngày",
  );
  expect(patches).toEqual([{ numDays: 2 }]);

  failure = null;
  await page.getByLabel(/^Số ngày/).fill("4");
  await page.getByLabel(/^Ngân sách dự kiến/).fill("800000");
  await expect(page.getByLabel(/^Ngân sách dự kiến/)).toHaveValue(
    "800.000 VND",
  );
  await save.click();
  await expect(page.getByText("Đã lưu thông tin lộ trình.")).toBeVisible();
  expect(patches.at(-1)).toEqual({ numDays: 4, budgetAmount: 800000 });
  await expect(page.locator(".detail-list")).toContainText("4 ngày");

  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await page.getByLabel(/^Tên lộ trình/).fill("Tên chưa lưu");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
  await dialog.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(
    page.getByRole("heading", { name: "3 ngày ăn ngon Hà Nội" }),
  ).toBeVisible();
  expect(patches).toHaveLength(2);
});

// Opens the shared map dialog (coordinate entry only, empty token). Run manually: ROADMAP_MAP=1.
test("a pinned origin from typed coordinates is sent with its label", async ({
  page,
}) => {
  test.skip(!process.env.ROADMAP_MAP, "Map dialog check is run by the owner.");
  const providerCalls: string[] = [];
  page.on("request", (request) => {
    if (/mapbox\.com/.test(request.url())) providerCalls.push(request.url());
  });
  await open(page);
  await chooseProvince(page, "Thành phố Đà Nẵng");
  // Pressing "Chấm trên bản đồ" opens the map dialog at once; closing it unsets the choice.
  await choice(page, "pinned").click();
  const map = page.getByRole("dialog", { name: "Chọn điểm xuất phát" });
  await expect(map).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(map).toBeHidden();
  await expect(choice(page, "pinned")).toHaveAttribute("aria-pressed", "false");
  await expect(choice(page, "pinned")).toBeFocused();
  await choice(page, "pinned").click();
  await map.getByLabel("Vĩ độ").fill("16.061204");
  await map.getByLabel("Kinh độ").fill("108.227531");
  await map.getByRole("button", { name: "Lưu điểm xuất phát" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  // Without a Mapbox token the address cannot be looked up: the province is kept and the
  // traveler is told to choose it.
  await expect(
    page.getByText("Chưa tự lấy được tỉnh / thành phố từ điểm đã chấm", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Bạn muốn ăn ở đâu\?/)).toHaveValue(
    "Thành phố Đà Nẵng",
  );
  await page.getByLabel(/^Tên điểm xuất phát/).fill("Khách sạn Sala Đà Nẵng");
  await submit(page).click();
  await expect(page.locator(".detail-list")).toContainText(
    "Khách sạn Sala Đà Nẵng · 16.061204, 108.227531",
  );
  expect(creates.at(-1)).toMatchObject({
    originMode: "pinned",
    originLatitude: 16.061204,
    originLongitude: 108.227531,
    originLabel: "Khách sạn Sala Đà Nẵng",
  });
  expect(providerCalls).toEqual([]);
});

test("the planner has no horizontal overflow from 320px to 1440px", async ({
  page,
}) => {
  await open(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width}px`,
    ).toBe(true);
  }
});
