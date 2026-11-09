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
} from "../../src/features/roadmaps/roadmap-types";

/** F-19 "Lập lộ trình mới" dialog: RM-01 against a local stub. No Mapbox request is made (empty token). */
const creates: CreateRoadmapRequestDto[] = [];
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
  // RM-02 for "Lộ trình của tôi" behind the dialog: no roadmap yet.
  if (method === "GET" && url.startsWith("/api/v1/roadmaps?")) {
    send(200, {
      items: [],
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 0,
    });
    return true;
  }
  // RM-03 for the detail page opened after creation.
  if (method === "GET" && url === "/api/v1/roadmaps/88") {
    if (current) send(200, current);
    else send(404, null, "ROADMAP_NOT_FOUND");
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

const planner = (page: Page) =>
  page.getByRole("dialog", { name: "Lập lộ trình mới" });
const next = (page: Page) =>
  planner(page).getByRole("button", { name: "Tiếp tục", exact: true });
const submit = (page: Page) =>
  planner(page).getByRole("button", { name: "Tạo lộ trình", exact: true });
const knowledge = (page: Page, value: "known" | "unknown") =>
  planner(page).locator(`[data-knowledge="${value}"]`);
const choice = (page: Page, mode: "pinned" | "gps") =>
  planner(page).locator(`[data-origin-choice="${mode}"]`);

/** "Lộ trình của tôi" → "Lập lộ trình mới". */
async function open(page: Page) {
  await loginAs(page, "traveler");
  await page.goto("/roadmaps");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Lập lộ trình mới" })
    .first()
    .click();
  await expect(planner(page)).toBeVisible();
  await expect(planner(page)).toContainText("Bước 1 / 2");
}

/** The field only takes a province of the catalog: type, then pick it from the list. */
async function chooseProvince(page: Page, label: RegExp, name: string) {
  await planner(page).getByLabel(label).fill(name);
  // Escape before the list opens would close the whole dialog; picking the option is certain.
  await page.getByRole("option", { name, exact: true }).click();
  await expect(planner(page).getByLabel(label)).toHaveValue(name);
}

/** Step 1 with only the city, then step 2. */
async function cityOnly(page: Page, name = "Thành phố Hà Nội") {
  await knowledge(page, "unknown").click();
  await chooseProvince(page, /^Bạn sẽ đến tỉnh \/ thành phố nào\?/, name);
  await next(page).click();
  await expect(planner(page)).toContainText("Bước 2 / 2");
}

test("/roadmaps/new is gone: old links open the dialog over the list, for Travelers only", async ({
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
  await page.goto("/roadmaps/new");
  await expect(page).toHaveURL(/\/roadmaps\?new=1$/);
  await expect(planner(page)).toBeVisible();
  // Closing drops ?new=1, so a reload does not open it again.
  await planner(page).getByRole("button", { name: "Hủy" }).click();
  await expect(planner(page)).toBeHidden();
  await expect(page).toHaveURL(/\/roadmaps$/);
});

test("step 1 asks where the traveler will be before anything else", async ({
  page,
}) => {
  await open(page);
  await next(page).click();
  await expect(
    planner(page).getByText(
      "Cho ANGI biết bạn đã biết chính xác nơi sẽ đến chưa.",
    ),
  ).toBeVisible();
  // Knowing the place needs a point or the current location, and a city.
  await knowledge(page, "known").click();
  await expect(knowledge(page, "known")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(choice(page, "pinned")).toBeVisible();
  await expect(choice(page, "gps")).toBeVisible();
  await next(page).click();
  await expect(
    planner(page).getByText(
      "Chấm vị trí trên bản đồ hoặc dùng vị trí hiện tại.",
    ),
  ).toBeVisible();
  // The city comes with the place: no city field until a place is chosen.
  await expect(planner(page).getByLabel(/^Tỉnh \/ thành phố/)).toHaveCount(0);
  // Not knowing it needs only the city; the location choices disappear.
  await knowledge(page, "unknown").click();
  await expect(choice(page, "pinned")).toHaveCount(0);
  await next(page).click();
  await expect(
    planner(page).getByLabel(/^Bạn sẽ đến tỉnh \/ thành phố nào\?/),
  ).toBeFocused();
  expect(creates).toEqual([]);
});

test("the destination takes only a province picked from the list", async ({
  page,
}) => {
  await open(page);
  await knowledge(page, "unknown").click();
  const field = planner(page).getByLabel(/^Bạn sẽ đến tỉnh \/ thành phố nào\?/);
  // Text that is not a province is dropped when the field is left.
  await field.fill("Hà");
  await expect(planner(page).getByRole("option").first()).toBeVisible();
  await field.press("Tab");
  await expect(field).toHaveValue("");
  await next(page).click();
  await expect(planner(page)).toContainText(
    "Chọn tỉnh / thành phố bạn muốn đến.",
  );
  // A pick from the list is kept.
  await field.fill("Hà Nội");
  await planner(page).getByRole("option", { name: "Thành phố Hà Nội" }).click();
  await expect(field).toHaveValue("Thành phố Hà Nội");
  // A later partial edit that is abandoned puts the picked province back.
  await field.fill("Thành phố H");
  await field.press("Tab");
  await expect(field).toHaveValue("Thành phố Hà Nội");
  expect(creates).toEqual([]);
});

test("city only: step 2 creates the roadmap with the documented body and opens it", async ({
  page,
}) => {
  await open(page);
  await cityOnly(page);
  await expect(planner(page).locator(".new-roadmap-place")).toContainText(
    "Hà Nội",
  );
  await planner(page)
    .getByLabel(/^Số ngày/)
    .fill("2");
  // The title follows the destination until it is edited.
  await expect(planner(page).getByLabel(/^Tên lộ trình/)).toHaveValue(
    "Khám phá ẩm thực Hà Nội",
  );
  await submit(page).click();
  // The toast confirms at once; it stays across the move to the new roadmap.
  await expect(
    page.getByText("Đã tạo lộ trình.", { exact: false }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  // The city picked in step 1 is saved as the roadmap's destination.
  expect(creates).toEqual([
    {
      title: "Khám phá ẩm thực Hà Nội",
      numDays: 2,
      originMode: "none",
      destinationProvince: "Thành phố Hà Nội",
    },
  ]);
});

test("step 2 validates its own fields and Back keeps step 1", async ({
  page,
}) => {
  await open(page);
  await cityOnly(page);
  await planner(page)
    .getByLabel(/^Số ngày/)
    .fill("8");
  await planner(page)
    .getByLabel(/^Tên lộ trình/)
    .fill("");
  await submit(page).click();
  await expect(
    planner(page).getByText("Số ngày phải là số nguyên từ 1 đến 7."),
  ).toBeVisible();
  await expect(
    planner(page).getByText("Tên lộ trình là bắt buộc."),
  ).toBeVisible();
  await planner(page).getByRole("button", { name: "Quay lại" }).click();
  await expect(planner(page)).toContainText("Bước 1 / 2");
  await expect(knowledge(page, "unknown")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    planner(page).getByLabel(/^Bạn sẽ đến tỉnh \/ thành phố nào\?/),
  ).toHaveValue("Thành phố Hà Nội");
  expect(creates).toEqual([]);
});

test("current location: the browser is asked, no coordinates are sent", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.0678, longitude: 108.2208 });
  await open(page);
  await knowledge(page, "known").click();
  await choice(page, "gps").click();
  await expect(choice(page, "gps")).toHaveAttribute("aria-pressed", "true");
  await expect(planner(page).getByText(/Đã cho phép vị trí/)).toBeVisible();
  // Without a Mapbox token the city cannot be looked up: the traveler picks it.
  await chooseProvince(page, /^Tỉnh \/ thành phố/, "Thành phố Đà Nẵng");
  await next(page).click();
  await expect(planner(page).locator(".new-roadmap-place")).toContainText(
    "Vị trí hiện tại · Đà Nẵng",
  );
  await planner(page)
    .getByLabel(/^Ngày bắt đầu/)
    .fill("2026-10-30");
  const budget = planner(page).getByLabel(/^Ngân sách dự kiến/);
  await budget.pressSequentially("1500000");
  await expect(budget).toHaveValue("1.500.000 VND");
  await planner(page)
    .getByLabel(/^Tên lộ trình/)
    .fill("  Đà Nẵng cuối tuần ");
  await expect(planner(page).locator(".new-roadmap-summary")).toContainText(
    "30 thg 10, 2026 – 1 thg 11, 2026",
  );
  await submit(page).click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  expect(creates).toEqual([
    {
      title: "Đà Nẵng cuối tuần",
      startDate: "2026-10-30",
      numDays: 3,
      budgetAmount: 1500000,
      originMode: "gps",
      destinationProvince: "Thành phố Đà Nẵng",
    },
  ]);
});

test("a denied location keeps step 1 open and explains how to continue", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await open(page);
  await knowledge(page, "known").click();
  await choice(page, "gps").click();
  await expect(
    planner(page).getByText(/Trình duyệt đang chặn vị trí của trang này/),
  ).toBeVisible();
  await expect(choice(page, "gps")).toHaveAttribute("aria-pressed", "false");
  await next(page).click();
  await expect(planner(page)).toContainText("Bước 1 / 2");
  await expect(
    planner(page).getByText(
      "Chấm vị trí trên bản đồ hoặc dùng vị trí hiện tại.",
    ),
  ).toBeVisible();
  // Switching to "not sure yet" lets the traveler go on with the city.
  await knowledge(page, "unknown").click();
  await chooseProvince(
    page,
    /^Bạn sẽ đến tỉnh \/ thành phố nào\?/,
    "Thành phố Hà Nội",
  );
  await next(page).click();
  await expect(planner(page)).toContainText("Bước 2 / 2");
});

test("the budget is shown as Vietnamese currency while typing and sends plain digits", async ({
  page,
}) => {
  await open(page);
  await cityOnly(page);
  const budget = planner(page).getByLabel(/^Ngân sách dự kiến/);
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
  await budget.fill("2000000");
  await expect(budget).toHaveValue("2.000.000 VND");
  await submit(page).click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  expect(creates).toEqual([
    {
      title: "Khám phá ẩm thực Hà Nội",
      numDays: 3,
      budgetAmount: 2000000,
      originMode: "none",
      destinationProvince: "Thành phố Hà Nội",
    },
  ]);
});

test("a VALIDATION_FAILED response keeps every value and shows the field error", async ({
  page,
}) => {
  await open(page);
  await cityOnly(page);
  failure = {
    status: 400,
    errorCode: "VALIDATION_FAILED",
    errors: { Title: ["Tên roadmap không được vượt quá 200 ký tự."] },
  };
  await submit(page).click();
  await expect(
    planner(page).getByText("Tên roadmap không được vượt quá 200 ký tự."),
  ).toBeVisible();
  await expect(planner(page).locator(".alert-error")).toContainText(
    "Vui lòng kiểm tra thông tin đã nhập.",
  );
  await expect(planner(page).getByLabel(/^Tên lộ trình/)).toHaveValue(
    "Khám phá ẩm thực Hà Nội",
  );
  failure = null;
  await submit(page).click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  expect(creates).toHaveLength(2);
});

// Opens the shared map dialog (coordinate entry only, empty token). Run manually: ROADMAP_MAP=1.
test("a pinned point from typed coordinates is sent with its label", async ({
  page,
}) => {
  test.skip(!process.env.ROADMAP_MAP, "Map dialog check is run by the owner.");
  const providerCalls: string[] = [];
  page.on("request", (request) => {
    if (/mapbox\.com/.test(request.url())) providerCalls.push(request.url());
  });
  await open(page);
  await knowledge(page, "known").click();
  // Pressing "Chấm trên bản đồ" opens the map at once; closing it unsets the choice.
  await choice(page, "pinned").click();
  const map = page.getByRole("dialog", { name: "Chọn điểm xuất phát" });
  await expect(map).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(map).toBeHidden();
  await expect(choice(page, "pinned")).toHaveAttribute("aria-pressed", "false");
  await choice(page, "pinned").click();
  await map.getByLabel("Vĩ độ").fill("16.061204");
  await map.getByLabel("Kinh độ").fill("108.227531");
  await map.getByRole("button", { name: "Lưu điểm xuất phát" }).click();
  await expect(map).toBeHidden();
  // Without a Mapbox token the address cannot be looked up: the traveler picks the city.
  await chooseProvince(page, /^Tỉnh \/ thành phố/, "Thành phố Đà Nẵng");
  await next(page).click();
  await planner(page)
    .getByLabel(/^Tên điểm xuất phát/)
    .fill("Khách sạn Sala Đà Nẵng");
  await submit(page).click();
  await expect(page).toHaveURL(/\/roadmaps\/88$/);
  expect(creates.at(-1)).toMatchObject({
    originMode: "pinned",
    originLatitude: 16.061204,
    originLongitude: 108.227531,
    originLabel: "Khách sạn Sala Đà Nẵng",
    // A pinned roadmap keeps its city too.
    destinationProvince: "Thành phố Đà Nẵng",
  });
  expect(providerCalls).toEqual([]);
});

test("the dialog has no horizontal overflow from 320px to 1440px", async ({
  page,
}) => {
  await open(page);
  await cityOnly(page);
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
