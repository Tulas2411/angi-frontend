import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  profileSample,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
} from "./account-api-stub";

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub();
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(() => stub.reset());

const name = (page: Page) => page.getByLabel("Tên hiển thị");
const save = (page: Page) =>
  page.getByRole("button", { name: "Lưu thay đổi", exact: true });

async function open(page: Page) {
  await loginAs(page, "traveler");
  await page.goto("/account");
  await expect(name(page)).toHaveValue("Minh Anh");
}

test("loads ME-01 into the form and keeps save disabled until something changes", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByLabel("Số điện thoại")).toHaveValue("0901234567");
  await expect(page.getByLabel("Giới thiệu")).toHaveValue("Thích bún chả");
  await expect(page.getByLabel(/^Email/)).toHaveAttribute("readonly", "");
  await expect(save(page)).toBeDisabled();
});

test("ME-02 sends only the changed fields and displays the returned values", async ({
  page,
}) => {
  await open(page);
  await name(page).fill("  Minh Anh Mới  ");
  await save(page).click();
  await expect(page.getByText("Đã lưu thông tin tài khoản.")).toBeVisible();
  expect(stub.patches).toEqual([{ displayName: "Minh Anh Mới" }]);
  await expect(name(page)).toHaveValue("Minh Anh Mới");
  await expect(save(page)).toBeDisabled();
  // The header reads the refreshed session snapshot.
  await expect(page.locator("summary").first()).toHaveAccessibleName(
    /Minh Anh Mới/,
  );
});

test("clearing phone and bio sends explicit nulls", async ({ page }) => {
  await open(page);
  await page.getByLabel("Số điện thoại").fill("");
  await page.getByLabel("Giới thiệu").fill("");
  await save(page).click();
  await expect(page.getByText("Đã lưu thông tin tài khoản.")).toBeVisible();
  expect(stub.patches).toEqual([{ phone: null, bio: null }]);
});

test("client validation blocks an invalid name without calling the backend", async ({
  page,
}) => {
  await open(page);
  await name(page).fill("A");
  await save(page).click();
  await expect(
    page.getByText("Tên hiển thị phải từ 2 đến 100 ký tự."),
  ).toBeVisible();
  expect(stub.patches).toEqual([]);
});

test("a failed save keeps every edit and shows the backend field error", async ({
  page,
}) => {
  await open(page);
  stub.failPatch = {
    status: 400,
    errorCode: "VALIDATION_FAILED",
    errors: { Phone: ["Số điện thoại không hợp lệ."] },
  };
  await name(page).fill("Tên khác");
  await page.getByLabel("Số điện thoại").fill("abc");
  await save(page).click();
  await expect(page.getByText("Số điện thoại không hợp lệ.")).toBeVisible();
  await expect(name(page)).toHaveValue("Tên khác");
  await expect(page.getByLabel("Số điện thoại")).toHaveValue("abc");
  stub.failPatch = null;
  await save(page).click();
  await expect(page.getByText("Đã lưu thông tin tài khoản.")).toBeVisible();
});

test("discarding edits asks for confirmation in a dialog and restores the loaded values", async ({
  page,
}) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => {
    nativeDialogs.push(dialog.type());
    void dialog.dismiss();
  });
  await open(page);
  await name(page).fill("Tên chưa lưu");
  const discard = page.getByRole("button", {
    name: "Hủy thay đổi",
    exact: true,
  });
  await discard.click();
  const dialog = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Tiếp tục chỉnh sửa" }).click();
  await expect(dialog).toBeHidden();
  await expect(discard).toBeFocused();
  await expect(name(page)).toHaveValue("Tên chưa lưu");
  await discard.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await discard.click();
  await dialog.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(name(page)).toHaveValue("Minh Anh");
  expect(stub.patches).toEqual([]);
  expect(nativeDialogs).toEqual([]);
});

test("a profile loading failure offers a retry", async ({ page }) => {
  await loginAs(page, "traveler");
  stub.failProfileGet = true;
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được thông tin tài khoản" }),
  ).toBeVisible();
  stub.failProfileGet = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(name(page)).toHaveValue("Minh Anh");
});

test("ME-03 password dialog validates, submits once and reports success", async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole("button", {
    name: "Đổi mật khẩu",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Đổi mật khẩu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Mật khẩu hiện tại/)).toBeFocused();
  await dialog.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(dialog.getByText("Nhập mật khẩu hiện tại.")).toBeVisible();
  expect(stub.passwords).toEqual([]);
  await dialog.getByLabel(/^Mật khẩu hiện tại/).fill("Old12345");
  await dialog.getByLabel(/^Mật khẩu mới/).fill("New12345");
  await dialog.getByLabel(/^Nhập lại mật khẩu mới/).fill("New12346");
  await dialog.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(
    dialog.getByText("Mật khẩu xác nhận chưa trùng khớp."),
  ).toBeVisible();
  await dialog.getByLabel(/^Nhập lại mật khẩu mới/).fill("New12345");
  await dialog.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page.getByText(/Đã cập nhật mật khẩu/)).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(stub.passwords).toEqual([
    { currentPassword: "Old12345", newPassword: "New12345" },
  ]);
});

test("a wrong current password is reported on that field and the dialog stays open", async ({
  page,
}) => {
  await open(page);
  stub.failPassword = { status: 400, errorCode: "WRONG_CURRENT_PASSWORD" };
  await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Đổi mật khẩu" });
  await dialog.getByLabel(/^Mật khẩu hiện tại/).fill("Wrong12345");
  await dialog.getByLabel(/^Mật khẩu mới/).fill("New12345");
  await dialog.getByLabel(/^Nhập lại mật khẩu mới/).fill("New12345");
  await dialog.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(dialog.getByText("Mật khẩu hiện tại chưa đúng.")).toBeVisible();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Đổi mật khẩu", exact: true }),
  ).toBeFocused();
});

test("an account without a password creates one without sending currentPassword", async ({
  page,
}) => {
  stub.profile = {
    ...profileSample(),
    hasPassword: false,
    linkedProviders: ["google"],
  };
  await open(page);
  await page.getByRole("button", { name: "Tạo mật khẩu", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo mật khẩu" });
  await expect(dialog.getByLabel(/^Mật khẩu hiện tại/)).toHaveCount(0);
  await dialog.getByLabel(/^Mật khẩu mới/).fill("New12345");
  await dialog.getByLabel(/^Nhập lại mật khẩu mới/).fill("New12345");
  await dialog.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page.getByText(/Đã cập nhật mật khẩu/)).toBeVisible();
  expect(stub.passwords).toEqual([{ newPassword: "New12345" }]);
});

test("the account page has no horizontal overflow from 320px to 1440px", async ({
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
