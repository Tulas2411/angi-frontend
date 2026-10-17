import { expect, type Page } from "@playwright/test";

export const dayRow = (page: Page, day = "Thứ hai") =>
  page.getByRole("listitem", { name: day, exact: true });
export const opening = (page: Page, day = "Thứ hai", slot = 1) =>
  page.getByLabel(`Giờ mở · ${day} · khoảng ${slot} *`, { exact: true });
export const closing = (page: Page, day = "Thứ hai", slot = 1) =>
  page.getByLabel(`Giờ đóng · ${day} · khoảng ${slot} *`, { exact: true });
export const saveWeek = (page: Page) =>
  page.getByRole("button", { name: "Lưu cả tuần", exact: true });
export async function editDay(page: Page, day = "Thứ hai") {
  await page
    .getByRole("button", { name: `Chỉnh giờ · ${day}`, exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: `Chỉnh giờ · ${day}`, exact: true }),
  ).toBeVisible();
}
export async function applyDay(page: Page) {
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: /^(Chỉnh giờ|Thêm khoảng) ·/ }),
  ).not.toBeVisible();
}
export async function addSlot(
  page: Page,
  day: string,
  slot: number,
  open: string,
  close: string,
) {
  await page
    .getByRole("button", { name: `Thêm khoảng · ${day}`, exact: true })
    .click();
  await opening(page, day, slot).fill(open);
  await closing(page, day, slot).fill(close);
  await applyDay(page);
}
export async function clearDay(page: Page, day = "Thứ hai") {
  await editDay(page, day);
  while (await page.getByLabel(/^Giờ mở ·/).count()) {
    await page
      .getByRole("button", { name: `Xóa khoảng 1 · ${day}`, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Xóa khoảng phục vụ?", exact: true })
      .getByRole("button", { name: "Xóa khoảng", exact: true })
      .click();
  }
  await applyDay(page);
}
