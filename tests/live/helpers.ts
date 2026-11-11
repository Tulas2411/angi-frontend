import { expect, type Page } from "@playwright/test";

export const accounts = {
  traveler: process.env.ANGI_TEST_TRAVELER_EMAIL!,
  owner: process.env.ANGI_TEST_OWNER_EMAIL!,
  ownerNew: process.env.ANGI_TEST_OWNER_NEW_EMAIL!,
  mod: process.env.ANGI_TEST_MOD_EMAIL!,
  admin: process.env.ANGI_TEST_ADMIN_EMAIL!,
};

export async function login(
  page: Page,
  email: string,
  password = process.env.ANGI_TEST_PASSWORD!,
) {
  // Leave any signed-in page first: clearing the session under a mounted page triggers its own
  // 401 redirect, which would race with the navigation below.
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Mật khẩu/).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  // The sign-in redirect is a full navigation; let it settle before the next action.
  await page.waitForLoadState("load");
}

/** Fails the test on page errors and on any native alert/confirm/prompt. */
export function guardBrowser(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("dialog", async (dialog) => {
    problems.push(`native ${dialog.type()}`);
    await dialog.dismiss();
  });
  return () => expect(problems).toEqual([]);
}

export async function confirm(page: Page, title: string, label = "Xác nhận") {
  const modal = page.getByRole("dialog", { name: title, exact: true });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: label, exact: true }).click();
  await expect(modal).not.toBeVisible();
}
