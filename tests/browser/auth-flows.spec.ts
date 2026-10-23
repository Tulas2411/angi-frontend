import { expect, test } from "@playwright/test";

test("reset-password submits the token from the URL with the new password", async ({
  page,
}) => {
  let submitted: unknown;
  await page.route("**/auth/reset-password", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      json: {
        success: true,
        message: null,
        errorCode: null,
        data: { userId: "test-user", status: "active" },
      },
    });
  });

  await page.goto("/reset-password?token=test-reset-token");
  await page.getByLabel(/^Mật khẩu mới/).fill("Password123");
  await page.getByLabel(/^Nhập lại mật khẩu/).fill("Password123");
  await page
    .getByRole("button", { name: "Đặt lại mật khẩu", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Đặt lại mật khẩu thành công" }),
  ).toBeVisible();
  expect(submitted).toEqual({
    token: "test-reset-token",
    newPassword: "Password123",
  });
});

test("reset-password without a token redirects to forgot-password", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByLabel(/^Email/)).toBeVisible();
});

test("demo reset-password works without a token and sends no reset request", async ({
  page,
}) => {
  let resetRequests = 0;
  await page.route("**/auth/reset-password", async (route) => {
    resetRequests++;
    await route.abort();
  });

  await page.goto("/demo/guest/reset-password");
  await page.getByLabel(/^Mật khẩu mới/).fill("Password123");
  await page.getByLabel(/^Nhập lại mật khẩu/).fill("Password123");
  await page
    .getByRole("button", { name: "Đặt lại mật khẩu", exact: true })
    .click();

  await expect(
    page.getByRole("heading", { name: "Đặt lại mật khẩu thành công" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/demo\/guest\/reset-password$/);
  expect(resetRequests).toBe(0);
});

test("email verification displays an expired-link error with recovery links", async ({
  page,
}) => {
  await page.route("**/auth/verify-email", async (route) => {
    await route.fulfill({
      status: 400,
      json: {
        success: false,
        message: "Liên kết xác minh đã hết hạn.",
        errorCode: "TEST_EXPIRED_LINK",
        data: null,
      },
    });
  });

  await page.goto("/verify-email?token=expired-test-token");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Liên kết xác minh đã hết hạn." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Về trang chủ" }),
  ).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Đăng ký lại" })).toHaveAttribute(
    "href",
    "/register",
  );
});

test("successful email verification redirects and clears the pending email", async ({
  page,
}) => {
  let verificationRequests = 0;
  await page.addInitScript(() => {
    if (window.location.pathname === "/verify-email")
      localStorage.setItem("pending_verification_email", "test@angi.example");
  });
  await page.route("**/auth/verify-email", async (route) => {
    verificationRequests++;
    await route.fulfill({
      json: { success: true, message: null, errorCode: null, data: null },
    });
  });

  await page.goto("/verify-email?token=valid-test-token");
  await expect(page).toHaveURL(/\/verify-success\?email=test%40angi\.example$/);
  await expect(page.getByRole("status")).toContainText(
    "Xác minh email thành công!",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pending_verification_email"),
    ),
  ).toBeNull();
  expect(verificationRequests).toBe(1);
});
