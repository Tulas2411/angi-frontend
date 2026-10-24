import { expect, test, type Page, type Route } from "@playwright/test";
import type { UserProfileDto } from "../../src/api/services/profile-service";

const initialProfile = {
  id: 101,
  email: "profile-test@angi.example",
  role: "TRAVELER",
  displayName: "Nguyễn An",
  avatarUrl: null,
  phone: "0901234567",
  bio: "Hồ sơ ban đầu",
  status: "active",
  emailVerified: true,
  hasPassword: true,
  linkedProviders: [],
  preferenceStatus: null,
  restaurantId: null,
  permissions: [],
  createdAt: "2026-10-01T00:00:00Z",
} satisfies UserProfileDto;

async function mockProfile(
  page: Page,
  save: (route: Route) => Promise<void>,
  profile: UserProfileDto = initialProfile,
) {
  await page.route("**/api/backend/me", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { success: true, data: profile } });
    } else if (route.request().method() === "PATCH") {
      await save(route);
    } else {
      await route.abort();
    }
  });
}

test.beforeEach(async ({ page }) => {
  // Keep this form regression suite offline, including all map providers.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname.startsWith("/api/")
    ) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
});

test("loaded profile fills the editor and a successful save displays the returned values", async ({
  page,
}) => {
  let submitted: unknown;
  const savedProfile = {
    ...initialProfile,
    displayName: "Nguyễn Bình",
    phone: "0912345678",
    bio: "Giới thiệu đã sửa",
  };
  await mockProfile(page, async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, data: savedProfile } });
  });

  await page.goto("/demo/traveler/profile/edit");
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue(
    initialProfile.displayName,
  );
  await expect(page.getByLabel("Số điện thoại")).toHaveValue(
    initialProfile.phone,
  );
  await expect(page.getByLabel("Giới thiệu")).toHaveValue(initialProfile.bio);
  await page.getByLabel("Tên hiển thị").fill("  Nguyễn Bình  ");
  await page.getByLabel("Số điện thoại").fill(savedProfile.phone);
  await page.getByLabel("Giới thiệu").fill(savedProfile.bio);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();

  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Đã lưu thay đổi vào hồ sơ của bạn." }),
  ).toBeVisible();
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue(
    savedProfile.displayName,
  );
  expect(submitted).toEqual({
    displayName: savedProfile.displayName,
    phone: savedProfile.phone,
    bio: savedProfile.bio,
  });
});

test("a failed save keeps all edited profile fields", async ({ page }) => {
  await mockProfile(page, async (route) => {
    await route.fulfill({
      status: 503,
      json: {
        success: false,
        data: null,
        errorCode: "SERVICE_UNAVAILABLE",
        message: "Máy chủ tạm thời không sẵn sàng.",
      },
    });
  });

  await page.goto("/demo/traveler/profile/edit");
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue(
    initialProfile.displayName,
  );
  await page.getByLabel("Tên hiển thị").fill("Tên chưa lưu");
  await page.getByLabel("Số điện thoại").fill("0987654321");
  await page.getByLabel("Giới thiệu").fill("Nội dung chưa lưu");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Máy chủ tạm thời không sẵn sàng." }),
  ).toBeVisible();
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue("Tên chưa lưu");
  await expect(page.getByLabel("Số điện thoại")).toHaveValue("0987654321");
  await expect(page.getByLabel("Giới thiệu")).toHaveValue("Nội dung chưa lưu");
});

test("cancel restores every field from the loaded account profile", async ({
  page,
}) => {
  await mockProfile(page, (route) => route.abort(), {
    ...initialProfile,
    role: "RESTAURANT_OWNER",
  });

  await page.goto("/demo/owner/account");
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue(
    initialProfile.displayName,
  );
  await page.getByLabel("Tên hiển thị").fill("Tên chưa lưu");
  await page.getByLabel("Số điện thoại").fill("0987654321");
  await page.getByLabel("Giới thiệu").fill("Nội dung chưa lưu");
  await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();

  await expect(page.getByLabel("Tên hiển thị")).toHaveValue(
    initialProfile.displayName,
  );
  await expect(page.getByLabel("Số điện thoại")).toHaveValue(
    initialProfile.phone,
  );
  await expect(page.getByLabel("Giới thiệu")).toHaveValue(initialProfile.bio);
});
