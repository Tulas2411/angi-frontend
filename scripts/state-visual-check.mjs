import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const stateFilter = process.env.VISUAL_STATE_FILTER
  ? new RegExp(process.env.VISUAL_STATE_FILTER)
  : null;
const previous =
  stateFilter && fs.existsSync("artifacts/screenshots/states/manifest.json")
    ? JSON.parse(
        fs.readFileSync("artifacts/screenshots/states/manifest.json", "utf8"),
      )
    : null;
const browser = await chromium.launch({ headless: true }),
  base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  results = [],
  errors = [];
fs.mkdirSync("artifacts/screenshots/states", { recursive: true });
const button = (p, name) =>
    p.getByRole("button", { name, exact: true }).first().click(),
  tab = (p, name) => p.getByRole("tab", { name, exact: true }).click();
const capture = async (p, name, node) => {
  await p.addStyleTag({
    content: "nextjs-portal{display:none}.dev-scenario-controls{display:none}",
  });
  await p.evaluate(() => document.fonts.ready);
  const file = `artifacts/screenshots/states/${name}-${p.viewportSize().width}.png`;
  await p.screenshot({
    path: file,
    fullPage: (await p.getByRole("dialog").count()) === 0,
  });
  results.push({
    name,
    node,
    file,
    width: p.viewportSize().width,
    url: p.url(),
  });
};
async function scene(
  name,
  route,
  node,
  steps,
  viewport = { width: 1920, height: 1080 },
) {
  if (stateFilter && !stateFilter.test(name)) return;
  const p = await browser.newPage({ viewport, locale: "vi-VN" });
  p.setDefaultTimeout(10000);
  if (name === "dish-roll-rolling")
    await p.clock.install({ time: new Date("2026-10-09T00:00:00Z") });
  p.on("pageerror", (e) => errors.push({ name, message: e.message }));
  try {
    await p.goto(base + route, { waitUntil: "networkidle" });
    if (name === "dish-roll-rolling")
      await p.clock.pauseAt(new Date("2026-10-09T01:00:00Z"));
    if (steps) await steps(p);
    await capture(p, name, node);
  } catch (e) {
    errors.push({ name, message: e.message });
    console.log(`Failed ${name}: ${e.message.slice(0, 150)}`);
  } finally {
    await p.close();
  }
}
for (const [key, node] of [
  ["traveler-empty-trips", "447:28816"],
  ["traveler-my-guides", "447:29515"],
  ["traveler-edit-guide", "447:29725"],
  ["traveler-survey-finished", "447:28165"],
  ["traveler-notifications-read", "447:27930"],
  ["traveler-empty-meals", "137:694"],
  ["traveler-expenses", "137:709"],
  ["owner-onboarding", "465:49949"],
  ["owner-register-restaurant", "465:50141"],
  ["owner-verification-new", "465:51031"],
  ["owner-verification-supplement", "465:51278"],
  ["owner-menu-draft", "465:51705"],
  ["owner-menu-rejected", "465:52345"],
  ["owner-closed", "465:50782"],
  ["moderator-no-permission", "491:34080"],
  ["moderator-hidden-blog", "491:35440"],
  ["moderator-hidden-reply", "491:35843"],
  ["moderator-conflicting-report", "491:35059"],
  ["moderator-resolved-report", "491:35059"],
  ["admin-empty-directory", "879:28770"],
  ["admin-empty-audit", "879:15519"],
  ["admin-sync-pending", "879:15865"],
  ["admin-sync-completed", "879:15865"],
]) {
  await scene(key, "/dev/scenarios?state=" + key, node, async (p) => {
    if (
      key.includes("verification-new") ||
      key.includes("verification-supplement")
    )
      await tab(p, "Hồ sơ xác minh");
    if (key.includes("menu-draft") || key.includes("menu-rejected"))
      await tab(p, "Bản chỉnh sửa");
    if (key.includes("owner-closed")) await tab(p, "Trạng thái");
    if (key === "moderator-hidden-blog") await button(p, "Xem ngữ cảnh →");
    if (key === "moderator-hidden-reply")
      await p.getByRole("button", { name: "Mở →", exact: true }).nth(1).click();
    if (key === "admin-sync-pending") await tab(p, "Đang chờ");
    if (key === "admin-sync-completed") await tab(p, "Đã đồng bộ");
  });
}
for (const [name, node, open] of [
  ["dialog", "462:5679", "Mở hộp thoại"],
  ["drawer", "879:15402", "Mở drawer"],
  ["confirmation", "462:5679", "Xác nhận xóa"],
  ["map", "712:10323", "Chọn vị trí trên bản đồ"],
])
  for (const width of [1920, 390])
    await scene(name, "/dev/components", node, (p) => button(p, open), {
      width,
      height: width === 390 ? 844 : 1080,
    });
await scene(
  "map-selected",
  "/demo/traveler/roadmaps/new",
  "712:10323",
  async (p) => {
    await button(p, "Chọn địa điểm trên bản đồ");
    await p.getByLabel("Tìm địa chỉ hoặc địa điểm").fill("Phố");
    await button(p, "Phố cổ Hà Nội");
    await button(p, "Phóng to bản đồ");
  },
  { width: 1257, height: 1323 },
);
await scene(
  "planner-privacy-public",
  "/demo/traveler/roadmaps/new",
  "39:4913",
  (p) => p.getByLabel("Công khai", { exact: true }).check(),
  { width: 1257, height: 1323 },
);
await scene(
  "planner-invite-unavailable",
  "/demo/traveler/roadmaps/new",
  "39:4989",
  (p) => button(p, "＋ Mời bạn cùng xem"),
  { width: 1257, height: 1323 },
);
await scene(
  "share-unsaved-confirmation",
  "/demo/traveler/roadmaps/share",
  "781:10966",
  async (p) => {
    await p.getByLabel("Tiêu đề").fill("Ăn ngon Hà Nội");
    await p.getByRole("link", { name: "Trang chủ", exact: true }).click();
  },
);
await scene("upload-error", "/dev/components", "465:54244", async (p) => {
  await p.getByLabel("Ảnh món ăn", { exact: true }).setInputFiles({
    name: "khong-hop-le.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("demo"),
  });
  await expect(p.getByText("Chọn ảnh JPG, PNG hoặc WEBP.")).toBeVisible();
});
await scene("upload-selected", "/dev/components", "772:10996", async (p) => {
  await p
    .getByLabel("Ảnh món ăn", { exact: true })
    .setInputFiles("public/assets/figma/coffee.png");
  await expect(p.getByText("coffee.png", { exact: true })).toBeVisible();
});
await scene("password-dialog", "/demo/traveler/profile", "447:27705", (p) =>
  button(p, "Đổi mật khẩu"),
);
await scene(
  "review-create",
  "/demo/traveler/restaurants/bep-nha",
  "449:7999",
  async (p) => {
    await tab(p, "Đánh giá");
    await button(p, "Viết đánh giá");
  },
);
await scene(
  "owner-dish-editor",
  "/dev/scenarios?state=owner-menu-draft",
  "465:54587",
  async (p) => {
    await tab(p, "Bản chỉnh sửa");
    await button(p, "Thêm món");
  },
);
await scene(
  "owner-menu-review",
  "/dev/scenarios?state=owner-menu-draft",
  "465:51935",
  (p) => tab(p, "Kiểm tra và gửi duyệt"),
);
await scene("owner-menu-pending", "/demo/owner/menu", "465:52052", (p) =>
  tab(p, "Bản chỉnh sửa"),
);
await scene("owner-menu-history", "/demo/owner/menu", "465:52200", (p) =>
  tab(p, "Lịch sử gửi duyệt"),
);
await scene("owner-review-reply", "/demo/owner/reviews", "465:52828", (p) =>
  button(p, "Phản hồi"),
);
await scene("mod-sanction", "/demo/moderator/users/user-2", "491:33103", (p) =>
  button(p, "Tạm đình chỉ"),
);
await scene(
  "mod-restaurant-menu",
  "/demo/moderator/restaurants/bep-nha",
  "491:33419",
  (p) => tab(p, "Thực đơn"),
);
await scene(
  "mod-restaurant-owner",
  "/demo/moderator/restaurants/bep-nha",
  "491:33419",
  (p) => tab(p, "Chủ nhà hàng"),
);
await scene(
  "mod-hide-restaurant",
  "/demo/moderator/restaurants/bep-nha",
  "491:33657",
  (p) => button(p, "Ẩn nhà hàng"),
);
await scene(
  "mod-verification-reject",
  "/demo/moderator/verification/bep-nha",
  "491:34080",
  (p) => button(p, "Từ chối"),
);
await scene(
  "mod-menu-approve",
  "/demo/moderator/menus/bep-nha",
  "491:34564",
  (p) => button(p, "Phê duyệt"),
);
await scene("mod-blog-context", "/demo/moderator/community", "491:35440", (p) =>
  button(p, "Xem ngữ cảnh →"),
);
await scene("mod-review-detail", "/demo/moderator/reviews", "491:35805", (p) =>
  button(p, "Mở →"),
);
await scene(
  "mod-report-conclusion",
  "/demo/moderator/reports/report-1",
  "491:35059",
  async (p) => {
    await button(p, "Nhận xử lý");
    await button(p, "Kiểm tra và kết luận");
  },
);
await scene(
  "admin-create-mod-expanded",
  "/demo/admin/moderators",
  "879:28220",
  async (p) => {
    await button(p, "Thêm Mod");
    await p.getByLabel("Ghi đè riêng (tùy chọn)").check();
  },
);
await scene(
  "admin-edit-mod",
  "/demo/admin/moderators/mod-1",
  "879:27266",
  (p) => button(p, "Chỉnh sửa tên"),
);
await scene(
  "admin-deactivate-confirm",
  "/demo/admin/moderators",
  "879:28600",
  (p) => button(p, "Vô hiệu hóa"),
);
await scene(
  "admin-permission-confirm",
  "/demo/admin/moderators/mod-1/permissions",
  "879:27559",
  (p) => button(p, "Lưu quyền"),
);
await scene("admin-audit-drawer", "/demo/admin/audit", "879:15402", (p) =>
  button(p, "Xem chi tiết →"),
);
await scene("admin-sync-details", "/demo/admin/sync", "879:15624", (p) =>
  button(p, "Xem"),
);
await scene("admin-sync-retry", "/demo/admin/sync", "879:15811", (p) =>
  button(p, "Thử lại"),
);
for (const [name, label, node] of [
  ["roadmap-date-dialog", "Lịch chuyến đi", "137:710"],
  ["roadmap-budget-dialog", "Đặt ngân sách", "137:704"],
  ["roadmap-add-item", "＋ Thêm món ăn", "137:700"],
  ["roadmap-expense-dialog", "＋ Thêm chi phí", "137:707"],
])
  await scene(
    name,
    "/demo/traveler/roadmaps/ha-noi",
    node,
    (p) => button(p, label),
    { width: 1713, height: 923 },
  );
await scene(
  "roadmap-place-detail",
  "/demo/traveler/roadmaps/ha-noi",
  "137:698",
  (p) => p.getByRole("button").filter({ hasText: "Phở Thìn" }).click(),
  { width: 1713, height: 923 },
);
await scene(
  "dish-roll-revealed",
  "/demo/traveler/roll",
  "842:13533",
  async (p) => {
    await button(p, "Roll món ngay");
    await expect(
      p.getByRole("heading", { name: "Chốt món này nhé!" }),
    ).toBeVisible();
  },
);
await scene(
  "dish-roll-reduced-motion",
  "/demo/traveler/roll",
  "842:13780",
  async (p) => {
    await p.emulateMedia({ reducedMotion: "reduce" });
    await button(p, "Roll món ngay");
    await expect(
      p.getByRole("heading", { name: "Chốt món này nhé!" }),
    ).toBeVisible();
  },
);
await scene("dish-roll-empty", "/demo/traveler/roll", "842:13062", (p) =>
  tab(p, "Ăn chay"),
);
await scene(
  "roadmap-assistant-unavailable",
  "/demo/traveler/roadmaps/ha-noi",
  "137:712",
  (p) => button(p, "Hỏi trợ lý món ăn"),
  { width: 1713, height: 923 },
);
await scene(
  "planner-destination-suggestions",
  "/demo/traveler/roadmaps/new",
  "39:4064",
  async (p) => {
    await p.getByLabel("Ăn ở đâu?").fill("Hà");
    await expect(p.getByRole("listbox")).toBeVisible();
  },
  { width: 1257, height: 1323 },
);
await scene(
  "planner-ready",
  "/demo/traveler/roadmaps/new",
  "39:4681",
  async (p) => {
    await p.getByLabel("Ăn ở đâu?").fill("Hà Nội");
    await p.getByLabel("Ngày bắt đầu").fill("2026-10-10");
    await p.getByLabel("Ngày kết thúc").fill("2026-10-12");
    await p.getByLabel("Ngân sách dự kiến").fill("1500000");
  },
  { width: 1257, height: 1323 },
);
await scene(
  "roadmap-settings",
  "/demo/traveler/roadmaps/ha-noi",
  "168:694",
  (p) => p.getByText("Cài đặt chuyến đi", { exact: true }).click(),
  { width: 1713, height: 923 },
);
await scene(
  "roadmap-map-layers",
  "/demo/traveler/roadmaps/ha-noi",
  "137:711",
  (p) => p.getByText("Lớp bản đồ", { exact: true }).click(),
  { width: 1713, height: 923 },
);
await scene(
  "roadmap-note",
  "/demo/traveler/roadmaps/ha-noi",
  "137:702",
  (p) => button(p, "Sửa ghi chú"),
  { width: 1713, height: 923 },
);
await scene("gallery-menu", "/dev/components", "462:5539", (p) =>
  p.getByText("Mở menu", { exact: true }).click(),
);
await scene("gallery-tooltip", "/dev/components", "462:5679", (p) =>
  p.getByText("Trợ giúp ⓘ", { exact: true }).hover(),
);
await scene("dish-roll-rolling", "/demo/traveler/roll", "842:13298", (p) =>
  button(p, "Roll món ngay"),
);
await browser.close();
fs.writeFileSync(
  "artifacts/screenshots/states/manifest.json",
  JSON.stringify(
    {
      results: previous
        ? [
            ...previous.results.filter((r) => !stateFilter.test(r.name)),
            ...results,
          ]
        : results,
      errors: previous
        ? [
            ...previous.errors.filter((r) => !stateFilter.test(r.name)),
            ...errors,
          ]
        : errors,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ captures: results.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
