import type { RoleCode } from "@/features/auth/types";
import { restaurantHref } from "@/features/explore/explore-routes";
import { ownerRoutes, ownerVerificationHref } from "@/features/owner/routes";
import { roadmapDetailHref } from "@/features/roadmaps/routes";
import type { NotificationDto } from "./notification-types";

export const notificationPageSize = 10;
/** NOTI-03 accepts at most 100 ids per call. */
export const maxReadIds = 100;

export type NotificationFilter = "" | "unread";

export const notificationTabs: { value: NotificationFilter; label: string }[] =
  [
    { value: "", label: "Tất cả" },
    { value: "unread", label: "Chưa đọc" },
  ];

export function filterFromParam(value: string | null): NotificationFilter {
  return value === "unread" ? "unread" : "";
}

export function notificationsHref(filter: NotificationFilter, page: number) {
  const query = new URLSearchParams();
  if (filter) query.set("filter", filter);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/notifications?${text}` : "/notifications";
}

/** A positive id from `data`, written `blog_id` by the backend or `blogId` in the API Design. */
export function dataId(data: Record<string, unknown>, snake: string) {
  const camel = snake.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
  const value = Number(data[snake] ?? data[camel]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** The screen a notification opens; `null` when it only informs (a resolved report, a sanction). */
export function notificationHref(
  notification: Pick<NotificationDto, "type" | "data">,
  role: RoleCode,
): string | null {
  const { type, data } = notification;
  if (type.startsWith("BLOG_")) {
    const blogId = dataId(data, "blog_id");
    return blogId ? `/guides/${blogId}` : null;
  }
  if (type === "ROADMAP_GENERATED") {
    const roadmapId = dataId(data, "roadmap_id");
    return roadmapId ? roadmapDetailHref(roadmapId) : null;
  }
  if (type === "REVIEW_REPLIED") {
    const restaurantId = dataId(data, "restaurant_id");
    return restaurantId ? restaurantHref(restaurantId) : null;
  }
  if (role !== "RESTAURANT_OWNER") return null;
  if (type.startsWith("VERIFICATION_")) return ownerVerificationHref("status");
  if (type.startsWith("MENU_")) return ownerRoutes.menu;
  if (type === "RESTAURANT_REVIEWED") return "/restaurant/reviews";
  if (type.startsWith("RESTAURANT_")) return ownerRoutes.profile;
  return null;
}

/**
 * The kind of news a notification carries, used to pick its badge and colour.
 * The backend type is a free-form string, so anything unknown falls back to "general".
 */
export type NotificationCategory =
  | "blog"
  | "review"
  | "roadmap"
  | "menu"
  | "verification"
  | "report"
  | "account"
  | "general";

export interface NotificationCategoryInfo {
  key: NotificationCategory;
  /** A readable name of the kind of news, shown as a tag on a row. */
  label: string;
}

const CATEGORIES: Record<NotificationCategory, NotificationCategoryInfo> = {
  blog: { key: "blog", label: "Bài viết" },
  review: { key: "review", label: "Đánh giá" },
  roadmap: { key: "roadmap", label: "Lộ trình" },
  menu: { key: "menu", label: "Thực đơn" },
  verification: { key: "verification", label: "Xác minh" },
  report: { key: "report", label: "Báo cáo" },
  account: { key: "account", label: "Tài khoản" },
  general: { key: "general", label: "Thông báo" },
};

const CATEGORY_BY_PREFIX: [string, NotificationCategory][] = [
  ["BLOG_", "blog"],
  ["REVIEW_", "review"],
  ["RESTAURANT_REVIEWED", "review"],
  ["ROADMAP_", "roadmap"],
  ["MENU_", "menu"],
  ["VERIFICATION_", "verification"],
  ["REPORT_", "report"],
  ["ACCOUNT_", "account"],
];

export function notificationCategory(type: string): NotificationCategoryInfo {
  for (const [prefix, key] of CATEGORY_BY_PREFIX)
    if (type === prefix || type.startsWith(prefix)) return CATEGORIES[key];
  return CATEGORIES.general;
}

/** How many notifications the bell dropdown shows. */
export const notificationPreviewSize = 5;

const relative = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });
const fullDate = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

/** "5 phút trước", "Hôm qua", then the date once it is more than a week old. */
export function notificationTime(createdAt: string, now = Date.now()) {
  const seconds = Math.round((new Date(createdAt).getTime() - now) / 1000);
  if (Number.isNaN(seconds)) return "";
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(seconds / 3600);
  const days = Math.round(seconds / 86400);
  if (Math.abs(seconds) < 60) return "Vừa xong";
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  if (Math.abs(days) < 7) return relative.format(days, "day");
  return fullDate.format(new Date(createdAt));
}

export function fullNotificationTime(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "" : fullDate.format(date);
}

/** The badge never grows past three characters. */
export function unreadBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}

/**
 * A date bucket for the list: "Hôm nay", "Hôm qua", then the weekday for the last
 * week and the full date beyond that.
 */
export type NotificationDayGroup = "today" | "yesterday" | "week" | "older";

export function notificationDayGroup(
  createdAt: string,
  now = Date.now(),
): NotificationDayGroup {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "older";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86400000;
  if (date.getTime() >= startOfToday.getTime()) return "today";
  if (date.getTime() >= startOfToday.getTime() - day) return "yesterday";
  if (date.getTime() >= startOfToday.getTime() - 7 * day) return "week";
  return "older";
}

export const notificationDayLabels: Record<NotificationDayGroup, string> = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  week: "Tuần này",
  older: "Trước đó",
};
