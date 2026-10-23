import { expect, test } from "@playwright/test";
import { accounts, guardBrowser, login } from "./helpers";

/** Real backend: ME-01/02/03, role landings, wrong-role redirects and removed routes. */

test("each role lands on its home page and cannot use another role's workspace", async ({
  page,
}) => {
  const check = guardBrowser(page);
  for (const [email, landing] of [
    [accounts.traveler, /localhost:3001\/$/],
    [accounts.mod, /localhost:3001\/$/],
    [accounts.admin, /localhost:3001\/$/],
    [accounts.owner, /\/restaurant$/],
  ] as const) {
    await login(page, email);
    await expect(page).toHaveURL(landing);
    await page.goto("/");
    await expect(page).toHaveURL(landing);
  }
  for (const email of [accounts.traveler, accounts.mod, accounts.admin]) {
    await login(page, email);
    await page.goto("/restaurant/menu");
    await expect(page).toHaveURL(/localhost:3001\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { name: "Tài khoản của bạn", level: 1 }),
    ).toBeVisible();
  }
  check();
});

test("removed routes answer 404 and protected routes need a session", async ({
  page,
}) => {
  await login(page, accounts.traveler);
  for (const path of ["/demo", "/dev/components", "/dishes", "/administration"])
    expect((await page.goto(path))?.status(), path).toBe(404);
  await page.context().clearCookies();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("ME-02 profile edits persist across a reload and can be restored", async ({
  page,
}) => {
  const check = guardBrowser(page);
  await login(page, accounts.traveler);
  await page.goto("/account");
  const phone = page.getByLabel("Số điện thoại");
  const bio = page.getByLabel("Giới thiệu");
  await expect(page.getByLabel("Tên hiển thị")).not.toHaveValue("");
  const original = {
    phone: await phone.inputValue(),
    bio: await bio.inputValue(),
  };
  const stamp = String(Date.now()).slice(-6);
  await phone.fill(`09${stamp}12`);
  await bio.fill(`Kiểm thử giao diện ${stamp}`);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã lưu thông tin tài khoản.")).toBeVisible();
  await page.reload();
  await expect(phone).toHaveValue(`09${stamp}12`);
  await expect(bio).toHaveValue(`Kiểm thử giao diện ${stamp}`);
  // Restore the original values (empty values are sent as explicit null).
  await phone.fill(original.phone);
  await bio.fill(original.bio);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã lưu thông tin tài khoản.")).toBeVisible();
  await page.reload();
  await expect(phone).toHaveValue(original.phone);
  await expect(bio).toHaveValue(original.bio);
  check();
});

test("ME-03 a wrong current password is rejected, then the password changes and is restored", async ({
  page,
}) => {
  test.setTimeout(150000);
  const check = guardBrowser(page);
  const original = process.env.ANGI_TEST_PASSWORD!;
  const temporary = `Tmp${Date.now().toString(36)}a1`;
  await login(page, accounts.traveler);
  await page.goto("/account");

  const change = async (current: string, next: string) => {
    await page
      .getByRole("button", { name: "Đổi mật khẩu", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Đổi mật khẩu" });
    await expect(dialog.getByLabel(/^Mật khẩu hiện tại/)).toBeFocused();
    await dialog.getByLabel(/^Mật khẩu hiện tại/).fill(current);
    await dialog.getByLabel(/^Mật khẩu mới/).fill(next);
    await dialog.getByLabel(/^Nhập lại mật khẩu mới/).fill(next);
    await dialog.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
    return dialog;
  };

  const wrong = await change(`${original}-sai`, temporary);
  await expect(wrong.getByText("Mật khẩu hiện tại chưa đúng.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(wrong).toBeHidden();

  await change(original, temporary);
  await expect(page.getByText(/Đã cập nhật mật khẩu/)).toBeVisible();
  // The old password no longer works; the new one does.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(accounts.traveler);
  await page.getByLabel(/^Mật khẩu/).fill(original);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await login(page, accounts.traveler, temporary);
  await page.goto("/account");
  await change(temporary, original);
  await expect(page.getByText(/Đã cập nhật mật khẩu/)).toBeVisible();
  await login(page, accounts.traveler);
  await expect(page).toHaveURL(/localhost:3001\/$/);
  check();
});
