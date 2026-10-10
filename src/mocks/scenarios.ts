import type { AppData } from "@/features/platform/contracts";
import type { RoleCode } from "@/features/auth/types";
import { initialData } from "./fixtures";
export interface Scenario {
  label: string;
  role: RoleCode;
  segments: string[];
  node: string;
  apply: (data: AppData) => void;
}
export const scenarios: Record<string, Scenario> = {
  "traveler-empty-trips": {
    label: "Traveler · Chưa có lịch",
    role: "TRAVELER",
    segments: ["roadmaps"],
    node: "447:28816",
    apply: (d) => {
      d.trips = [];
    },
  },
  "traveler-my-guides": {
    label: "Traveler · Bài viết của tôi",
    role: "TRAVELER",
    segments: ["my-guides"],
    node: "447:29515",
    apply: (d) => {
      d.blogs[0].author = "Tuấn Nguyễn Minh";
    },
  },
  "traveler-edit-guide": {
    label: "Traveler · Sửa cẩm nang",
    role: "TRAVELER",
    segments: ["guides", "guide-1", "edit"],
    node: "447:29725",
    apply: (d) => {
      d.blogs[0].author = "Tuấn Nguyễn Minh";
    },
  },
  "traveler-survey-finished": {
    label: "Traveler · Đã kết thúc khảo sát",
    role: "TRAVELER",
    segments: ["survey"],
    node: "447:28165",
    apply: (d) => {
      d.surveyFinished = true;
    },
  },
  "traveler-notifications-read": {
    label: "Traveler · Đã đọc thông báo",
    role: "TRAVELER",
    segments: ["notifications"],
    node: "447:27930",
    apply: (d) => {
      d.notices.forEach((n) => (n.read = true));
    },
  },
  "traveler-empty-meals": {
    label: "Roadmap · Ngày chưa có món",
    role: "TRAVELER",
    segments: ["roadmaps", "ha-noi"],
    node: "137:694",
    apply: (d) => {
      d.trips[0].days[0].items = [];
    },
  },
  "traveler-expenses": {
    label: "Roadmap · Chi phí và sắp xếp",
    role: "TRAVELER",
    segments: ["roadmaps", "ha-noi"],
    node: "137:709",
    apply: (d) => {
      d.trips[0].expenses = [
        {
          id: "expense-1",
          name: "Phở sáng",
          amount: 65000,
          category: "Ăn uống",
          date: d.trips[0].start,
        },
        {
          id: "expense-2",
          name: "Cà phê trứng",
          amount: 40000,
          category: "Đồ uống",
          date: d.trips[0].start,
        },
      ];
    },
  },
  "owner-onboarding": {
    label: "Owner · Chưa có nhà hàng",
    role: "RESTAURANT_OWNER",
    segments: [],
    node: "465:49949",
    apply: (d) => {
      d.ownerRestaurantId = undefined;
    },
  },
  "owner-register-restaurant": {
    label: "Owner · Đăng ký nhà hàng",
    role: "RESTAURANT_OWNER",
    segments: ["profile"],
    node: "465:50141",
    apply: (d) => {
      d.ownerRestaurantId = undefined;
      d.restaurants = d.restaurants.filter((r) => r.id !== "bep-nha");
    },
  },
  "owner-verification-new": {
    label: "Owner · Hồ sơ xác minh mới",
    role: "RESTAURANT_OWNER",
    segments: ["verification"],
    node: "465:51031",
    apply: (d) => {
      d.submissions = d.submissions.filter((s) => s.kind !== "verification");
      d.restaurants[0].verification = "unverified";
    },
  },
  "owner-verification-supplement": {
    label: "Owner · Bổ sung hồ sơ",
    role: "RESTAURANT_OWNER",
    segments: ["verification"],
    node: "465:51278",
    apply: (d) => {
      const s = d.submissions.find((s) => s.kind === "verification")!;
      s.status = "needs_changes";
      s.note = "Bổ sung giấy phép còn hiệu lực.";
      d.restaurants[0].verification = "needs_changes";
    },
  },
  "owner-menu-draft": {
    label: "Owner · Bản chỉnh sửa thực đơn",
    role: "RESTAURANT_OWNER",
    segments: ["menu"],
    node: "465:51705",
    apply: (d) => {
      d.submissions.find((s) => s.kind === "menu")!.status = "draft";
    },
  },
  "owner-menu-rejected": {
    label: "Owner · Thực đơn bị từ chối",
    role: "RESTAURANT_OWNER",
    segments: ["menu"],
    node: "465:52345",
    apply: (d) => {
      const s = d.submissions.find((s) => s.kind === "menu")!;
      s.status = "rejected";
      s.note = "Ảnh món chưa rõ. Cập nhật ảnh và gửi lại bản mới.";
    },
  },
  "owner-closed": {
    label: "Owner · Đang đóng cửa",
    role: "RESTAURANT_OWNER",
    segments: ["profile"],
    node: "465:50782",
    apply: (d) => {
      d.restaurants[0].operating = "closed";
    },
  },
  "moderator-no-permission": {
    label: "Mod · Không có quyền quyết định",
    role: "MOD",
    segments: ["verification", "bep-nha"],
    node: "491:34080",
    apply: (d) => {
      d.moderators[0].overrides = [
        { permission: "restaurant.verify", effect: "deny" },
      ];
    },
  },
  "moderator-hidden-blog": {
    label: "Mod · Bài viết bị ẩn",
    role: "MOD",
    segments: ["community"],
    node: "491:35440",
    apply: (d) => {
      d.blogs[0].moderation = "hidden";
    },
  },
  "moderator-hidden-reply": {
    label: "Mod · Phản hồi bị ẩn",
    role: "MOD",
    segments: ["reviews"],
    node: "491:35843",
    apply: (d) => {
      d.reviews[1].replyModeration = "hidden";
    },
  },
  "moderator-conflicting-report": {
    label: "Mod · Báo cáo do người khác xử lý",
    role: "MOD",
    segments: ["reports", "report-2"],
    node: "491:35059",
    apply: (d) => {
      d.reports[1].assignee = "Minh Khuê";
    },
  },
  "moderator-resolved-report": {
    label: "Mod · Kết luận đã lưu",
    role: "MOD",
    segments: ["reports", "report-1"],
    node: "491:35059",
    apply: (d) => {
      d.reports[0].status = "resolved";
      d.reports[0].conclusion =
        "Đã đối chiếu giờ mở cửa. Không phát hiện vi phạm.";
    },
  },
  "admin-empty-directory": {
    label: "Admin · Danh sách Mod trống",
    role: "ADMIN",
    segments: ["moderators"],
    node: "879:28770",
    apply: (d) => {
      d.moderators = [];
    },
  },
  "admin-empty-audit": {
    label: "Admin · Nhật ký trống",
    role: "ADMIN",
    segments: ["audit"],
    node: "879:15519",
    apply: (d) => {
      d.audit = [];
    },
  },
  "admin-sync-pending": {
    label: "Admin · Đồng bộ đang chờ",
    role: "ADMIN",
    segments: ["sync"],
    node: "879:15865",
    apply: (d) => {
      d.sync[0].status = "pending";
    },
  },
  "admin-sync-completed": {
    label: "Admin · Sự kiện đã đồng bộ",
    role: "ADMIN",
    segments: ["sync"],
    node: "879:15865",
    apply: (d) => {
      d.sync[0].status = "completed";
      d.sync[0].error = null;
    },
  },
};
export function scenarioSeed(key: string) {
  const data = structuredClone(initialData);
  scenarios[key].apply(data);
  return data;
}
