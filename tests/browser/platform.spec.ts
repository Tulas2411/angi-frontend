import { expect, test } from "@playwright/test";

test("profile changes update the header and uploaded images survive client navigation", async ({
  page,
}) => {
  await page.goto("/demo/traveler/profile");
  await page.getByLabel("Tên hiển thị").fill("Nguyễn Minh An");
  await page
    .getByLabel("Ảnh đại diện", { exact: true })
    .setInputFiles("public/assets/figma/coffee.png");
  await expect(page.getByText("coffee.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  const account = page.getByLabel("Tài khoản Nguyễn Minh An", { exact: true });
  await expect(account).toBeVisible();
  await expect(account.locator("img")).toHaveAttribute("src", /^data:image/);
  await page
    .getByRole("navigation", { name: "Điều hướng công khai" })
    .getByRole("link", { name: "Cẩm nang ẩm thực", exact: true })
    .click();
  await expect(page).toHaveURL(/\/guides$/);
  await expect(account.locator("img")).toHaveAttribute("src", /^data:image/);
  await account.click();
  await page
    .getByRole("link", { name: "Tài khoản của tôi", exact: true })
    .click();
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue("Nguyễn Minh An");
  await expect(
    page.getByRole("img", { name: "Nguyễn Minh An", exact: true }).first(),
  ).toBeVisible();
});

test("public routes cannot create an authenticated session; real workspaces require login", async ({
  page,
}) => {
  for (const path of [
    "/discovery",
    "/restaurant",
    "/moderation",
    "/administration",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
  await page.goto("/demo/admin");
  expect(
    (await page.context().cookies()).filter((c) => c.name.includes("session")),
  ).toHaveLength(0);
  await page.goto("/demo/guest/register");
  await expect(page.getByLabel("Người khám phá")).toBeVisible();
  await expect(page.getByLabel("Chủ nhà hàng")).toBeVisible();
  await expect(page.getByLabel("Quản trị viên", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Tên hiển thị").fill("Người thử nghiệm");
  await page.getByLabel(/^Email/).fill("test@angi.example");
  await page.getByLabel(/^Mật khẩu \*/).fill("abcdefgh");
  await page.getByLabel(/^Nhập lại mật khẩu/).fill("abcdefgh");
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "chữ số" }),
  ).toBeVisible();
});

test("new trip validates fields, saves a budget and selects a map location", async ({
  page,
}) => {
  await page.goto("/demo/traveler/roadmaps/new");
  await page.getByLabel("Ăn ở đâu?").fill("Hà Nội");
  await page.getByLabel("Ngày bắt đầu").fill("2026-10-09");
  await page.getByLabel("Ngày kết thúc").fill("2026-10-11");
  await page.getByLabel("Ngân sách dự kiến").fill("500000");
  await page.getByRole("button", { name: /Chọn.*bản đồ/ }).click();
  const map = page.getByRole("dialog");
  await expect(map).toBeVisible();
  await page.getByLabel("Tìm địa chỉ hoặc địa điểm").fill("Phố");
  await map.getByRole("button", { name: "Phố cổ Hà Nội", exact: true }).click();
  await map.getByRole("button", { name: /Lưu|Chọn vị trí/ }).click();
  await expect(map).not.toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page).toHaveURL(/roadmaps\/[a-f0-9-]+$/);
  await expect(
    page.getByText("500.000", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText(/đi xe máy/).first()).toBeVisible();
  const like = page.getByRole("button", { name: /^Thích ảnh/ }).first();
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
});

test("destructive trip deletion requires confirmation and cancel preserves the record", async ({
  page,
}) => {
  await page.goto("/demo/traveler/roadmaps");
  await page.getByRole("button", { name: "Xóa lịch", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ăn ngon Hà Nội" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa lịch", exact: true }).click();
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lịch ăn của bạn còn trống" }),
  ).toBeVisible();
});

test("Mod creation uses invitations and activation remains a confirmed operation", async ({
  page,
}) => {
  await page.goto("/demo/admin/moderators");
  await page.getByRole("button", { name: "Thêm Mod", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Mật khẩu", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Tên hiển thị").fill("Thành Nam");
  await dialog.getByLabel("Email").fill("thanh.nam@angi.example");
  await dialog.getByRole("button", { name: /Tạo Mod và lời mời/ }).click();
  await expect(page.getByText("thanh.nam@angi.example").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Vô hiệu hóa", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Vô hiệu hóa", exact: true }).first(),
  ).toBeVisible();
});

test("saving inherit replaces all overrides and does not grant Admin-only permissions", async ({
  page,
}) => {
  await page.goto("/demo/admin/moderators/mod-1/permissions");
  await page.getByRole("button", { name: "Kế thừa tất cả" }).click();
  await page.getByRole("button", { name: "Lưu quyền", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("0 quyền ghi đè");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận" })
    .click();
  await expect(page.getByRole("status").last()).toContainText(
    "thay thế toàn bộ",
  );
  await expect(
    page.getByText("Chỉ Quản trị viên", { exact: true }).first(),
  ).toBeVisible();
});

test("retry queues a single dead synchronization event", async ({ page }) => {
  await page.goto("/demo/admin/sync");
  const retry = page.getByRole("button", { name: "Thử lại", exact: true });
  await expect(retry).toHaveCount(3);
  await retry.first().click();
  await expect(page.getByRole("dialog")).toContainText("msg-804");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đưa vào hàng đợi", exact: true })
    .click();
  await expect(retry).toHaveCount(2);
  await page.getByRole("tab", { name: "Đang chờ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status").last()).toContainText(
    "Chưa hoàn tất đồng bộ",
  );
});

test("Owner pending menu is read-only and draft removal leaves current menu intact", async ({
  page,
}) => {
  await page.goto("/demo/owner/menu");
  await page.getByRole("tab", { name: "Bản chỉnh sửa", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Thêm món", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Hủy bản chỉnh sửa" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận" })
    .click();
  await page.getByRole("button", { name: "Tạo bản chỉnh sửa mới" }).click();
  await page.getByRole("button", { name: "Bỏ", exact: true }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận" })
    .click();
  await expect(
    page.getByRole("heading", { name: "4 món sau chỉnh sửa" }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Thực đơn hiện tại", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "5 món trong thực đơn" }),
  ).toBeVisible();
});

test("unsaved sharing confirms exit, map dialog supports Escape and tab keyboard navigation", async ({
  page,
}) => {
  await page.goto("/demo/traveler/roadmaps/share");
  await page.getByLabel("Tiêu đề").fill("Chuyến đi của tôi");
  await page.getByRole("link", { name: "Trang chủ", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Nội dung chưa đăng sẽ bị mất",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  await expect(page.getByLabel("Tiêu đề")).toHaveValue("Chuyến đi của tôi");
  await page.goto("/dev/components");
  await page.getByRole("button", { name: "Mở hộp thoại", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mở hộp thoại", exact: true }),
  ).toBeFocused();
  const tab = page.getByRole("tab", { name: "Mặc định", exact: true });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Đã chọn", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
