import { expect, test } from "@playwright/test";

/**
 * Kiểm tra luồng phản hồi đánh giá trong bản minh họa của chủ nhà hàng.
 * Chạy với `npx playwright test tests/owner-reviews.spec.ts --config=playwright.owner.config.ts`
 */
test("chủ nhà hàng lọc và phản hồi được đánh giá", async ({ page }) => {
  await page.goto("/demo/owner/reviews");

  await expect(page.getByRole("heading", { name: "Lắng nghe thực khách" })).toBeVisible();
  await expect(page.getByText("15 đánh giá")).toBeVisible();

  // Lọc theo số sao.
  const starsFilter = page.locator(".owner-reviews-filters select").nth(1);
  const replyFilter = page.locator(".owner-reviews-filters select").first();

  await starsFilter.selectOption("1");
  await expect(page.getByText("1 đánh giá")).toBeVisible();
  await expect(page.getByText("Phục vụ chậm và thiếu thái độ")).toBeVisible();

  // Trở lại toàn bộ và lọc theo trạng thái phản hồi.
  await starsFilter.selectOption("all");
  await replyFilter.selectOption("unanswered");
  // Đánh giá chưa có phản hồi của Thảo Nguyễn phải xuất hiện, đồng thời các
  // đánh giá đã phản hồi không còn trong danh sách.
  await expect(
    page.getByText("Món ăn bình thường, giá hơi cao so với chất lượng."),
  ).toBeVisible();
  await expect(
    page.getByText("Cảm ơn chị Mai Anh đã ghé quán!"),
  ).toBeHidden();

  // Mở hộp thoại soạn phản hồi.
  await page.getByRole("button", { name: "Phản hồi" }).first().click();
  const textarea = page.getByLabel("Phản hồi của nhà hàng");
  await expect(textarea).toBeVisible();

  // Rỗng thì form không gửi được (ràng buộc `required` của trình duyệt).
  await page.getByRole("button", { name: "Lưu phản hồi" }).click();
  await expect(textarea).toHaveJSProperty("validity.valueMissing", true);
  await expect(
    page.getByText("Cảm ơn chị, Bếp Nhà đã ghi nhận góp ý của chị."),
  ).toBeHidden();

  // Gửi thành công thì đánh giá chuyển sang đã phản hồi.
  await textarea.fill("Cảm ơn chị, Bếp Nhà đã ghi nhận góp ý của chị.");
  await page.getByRole("button", { name: "Lưu phản hồi" }).click();
  await expect(page.getByText("Đã gửi phản hồi tới Thảo Nguyễn.")).toBeVisible();

  // Bộ lọc "chưa phản hồi" loại bỏ chính đánh giá vừa phản hồi.
  await expect(
    page.getByText("Món ăn bình thường, giá hơi cao so với chất lượng."),
  ).toBeHidden();

  // Xem lại toàn bộ thì thấy phản hồi ở trạng thái chờ kiểm duyệt.
  await replyFilter.selectOption("all");
  await expect(
    page.getByText("Bếp Nhà đã ghi nhận góp ý của chị."),
  ).toBeVisible();
  await expect(page.getByText("Đang chờ kiểm duyệt")).toBeVisible();
});

test("phân trang 10 đánh giá mỗi trang", async ({ page }) => {
  await page.goto("/demo/owner/reviews");

  // 15 đánh giá → trang đầu có 10 mục và 2 trang.
  await expect(page.locator(".owner-review")).toHaveCount(10);
  await expect(page.getByText("Trang 1 / 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Trang trước" })).toBeDisabled();

  // Sang trang 2 chỉ còn 5 mục còn lại.
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.locator(".owner-review")).toHaveCount(5);
  await expect(page.getByText("Trang 2 / 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Trang sau" })).toBeDisabled();

  await page.getByRole("button", { name: "Trang trước" }).click();
  await expect(page.locator(".owner-review")).toHaveCount(10);
});

test("đổi bộ lọc thì quay về trang đầu", async ({ page }) => {
  await page.goto("/demo/owner/reviews");

  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.getByText("Trang 2 / 2")).toBeVisible();

  // Bộ lọc thu hẹp còn 1 kết quả: không được bị kẹt ở trang không có dữ liệu.
  const starsFilter = page.locator(".owner-reviews-filters select").nth(1);
  await starsFilter.selectOption("1");
  await expect(page.locator(".owner-review")).toHaveCount(1);
  await expect(page.getByText("Trang 2 / 2")).toBeHidden();
});

test("gỡ phản hồi cần xác nhận", async ({ page }) => {
  await page.goto("/demo/owner/reviews");

  await page.getByRole("button", { name: "Sửa phản hồi" }).first().click();
  await page.getByRole("button", { name: "Gỡ phản hồi" }).click();
  await page.getByRole("button", { name: "Gỡ phản hồi", exact: true }).last().click();

  await expect(page.getByText("Đã gỡ phản hồi")).toBeVisible();
});

test("không phản hồi được đánh giá đang bị ẩn", async ({ page }) => {
  await page.goto("/demo/owner/reviews");

  const hidden = page.locator(".owner-review", {
    hasText: "đang bị ẩn",
  });
  await expect(hidden.getByRole("button", { name: "Phản hồi" })).toBeDisabled();
});