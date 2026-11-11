import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

/** F-57 Review Verification Submission: MOD-V1..MOD-V3 against a stub shaped like the DTOs. */
let calls: string[] = [];
let status = "pending";
let alreadyReviewed = false;

const restaurant = {
  id: 7,
  name: "Bún Bò Bà Diệu",
  slug: "bun-bo-ba-dieu",
  coverUrl: null,
  addressLine: "12 Lê Duẩn",
  ward: "Phường Hải Châu",
  district: null,
  provinceName: "Thành phố Đà Nẵng",
  latitude: 16.07,
  longitude: 108.22,
  priceLevel: 2,
  ratingAvg: 0,
  ratingCount: 0,
  operatingStatus: "open",
  isOpenNow: true,
  distanceKm: null,
};
const dossier = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  restaurantId: 7,
  status,
  legalName: "Hộ kinh doanh Bún Bò Bà Diệu",
  businessLicenseNo: "0401234567",
  taxCode: null,
  ownerNote: "Gửi lại giấy phép mới",
  documents: [
    {
      docType: "business_license",
      mediaId: 91,
      url: "https://cdn.angi.test/doc/license.jpg?sig=x",
    },
  ],
  previousId: 40,
  submittedAt: "2026-10-01T02:00:00Z",
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  ...over,
});

const handler: StubHandler = ({ method, url, body }, send) => {
  const parsed = new URL(url, "http://stub");
  const path = parsed.pathname;
  if (!path.startsWith("/api/v1/mod/verifications")) return false;
  if (method === "GET" && path === "/api/v1/mod/verifications") {
    calls.push(`MOD-V1 ${parsed.search.slice(1)}`);
    const items =
      parsed.searchParams.get("status") === status
        ? [{ ...dossier(41), restaurant }]
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
  if (method === "GET" && path === "/api/v1/mod/verifications/41") {
    calls.push("MOD-V2 41");
    send(200, {
      ...dossier(41),
      restaurant: {
        ...restaurant,
        description: "Quán gia đình",
        phone: "0236 3812 345",
        email: null,
        website: null,
        images: [],
        imageMediaIds: [],
        businessHours: [],
        verificationStatus: "pending",
        moderationStatus: "visible",
        createdAt: "2026-09-20T03:00:00Z",
        updatedAt: "2026-10-01T02:00:00Z",
      },
      previous: dossier(40, {
        status: "needs_more_info",
        businessLicenseNo: "0400000000",
        previousId: null,
        reviewNote: "Giấy phép đã hết hạn.",
      }),
    });
    return true;
  }
  if (method === "GET" && path === "/api/v1/mod/verifications/999") {
    send(404, null, "VERIFICATION_NOT_FOUND");
    return true;
  }
  if (method === "POST" && path === "/api/v1/mod/verifications/41/decision") {
    calls.push(`MOD-V3 ${JSON.stringify(body)}`);
    if (alreadyReviewed) {
      send(409, null, "VERIFICATION_ALREADY_REVIEWED");
      return true;
    }
    const decision = (body as { decision: string }).decision;
    status =
      decision === "approve"
        ? "approved"
        : decision === "reject"
          ? "rejected"
          : "needs_more_info";
    send(200, dossier(41));
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
  alreadyReviewed = false;
});

async function open(page: Page, path = "/moderation/verification") {
  await loginAs(page, "mod");
  await page.goto(path);
}

test("the queue lists pending dossiers oldest first and switches status (MOD-V1)", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Xác minh nhà hàng", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Bún Bò Bà Diệu")).toBeVisible();
  await expect(page.getByText("Nộp lại")).toBeVisible();
  expect(calls[0]).toBe("MOD-V1 status=pending&page=1&pageSize=20");
  await page.getByRole("button", { name: "Đã duyệt" }).click();
  await expect(page.getByText("Không có hồ sơ nào")).toBeVisible();
});

test("the review shows the dossier, the previous one and its changes (MOD-V2)", async ({
  page,
}) => {
  await open(page, "/moderation/verification/41");
  await expect(
    page.getByRole("heading", { name: "Bún Bò Bà Diệu", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Giấy phép kinh doanh/ }),
  ).toHaveAttribute("href", "https://cdn.angi.test/doc/license.jpg?sig=x");
  await expect(page.getByText("Giấy phép đã hết hạn.")).toBeVisible();
  await expect(page.getByText("Đã đổi")).toBeVisible();
});

test("rejecting needs a reason, then asks and sends MOD-V3", async ({
  page,
}) => {
  await open(page, "/moderation/verification/41");
  await page.getByRole("radio", { name: /Từ chối/ }).check();
  await page.getByRole("button", { name: "Từ chối hồ sơ" }).click();
  await expect(
    page.getByText("Ghi lý do từ chối để chủ quán biết cần sửa gì."),
  ).toBeVisible();
  await page
    .getByLabel(/^Lý do từ chối/)
    .fill("  Giấy phép không khớp tên quán  ");
  await page.getByRole("button", { name: "Từ chối hồ sơ" }).click();
  const confirm = page.getByRole("dialog", {
    name: /Từ chối cho Bún Bò Bà Diệu/,
  });
  await confirm.getByRole("button", { name: "Từ chối hồ sơ" }).click();
  await expect(confirm).toBeHidden();
  expect(calls).toContain(
    'MOD-V3 {"decision":"reject","reviewNote":"Giấy phép không khớp tên quán"}',
  );
  await expect(page.getByText("Đã từ chối hồ sơ.")).toBeVisible();
});

test("a dossier another Mod just handled is told and read again (409)", async ({
  page,
}) => {
  await open(page, "/moderation/verification/41");
  alreadyReviewed = true;
  await page.getByRole("button", { name: "Duyệt hồ sơ" }).click();
  await page
    .getByRole("dialog", { name: /Duyệt hồ sơ cho/ })
    .getByRole("button", { name: "Duyệt hồ sơ" })
    .click();
  await expect(page.getByText(/vừa được một Mod khác xử lý/)).toBeVisible();
  await expect
    .poll(() => calls.filter((c) => c === "MOD-V2 41").length)
    .toBe(2);
});

test("an unknown dossier says so", async ({ page }) => {
  await open(page, "/moderation/verification/999");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy hồ sơ" }),
  ).toBeVisible();
});

test("the queue and the review fit from 320px to 1440px", async ({ page }) => {
  for (const path of [
    "/moderation/verification",
    "/moderation/verification/41",
  ]) {
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
