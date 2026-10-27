/**
 * Wire DTO của NOTI-01..03 (`MeNotificationController`) + ánh xạ sang view model.
 *
 * Hợp đồng BE (API Design v1.8, sheet "Backend API" R14..R16):
 *  - `GET  /api/v1/me/notifications`             → NOTI-01, query `isRead?`, `type?`, `page`, `pageSize`.
 *  - `GET  /api/v1/me/notifications/unread-count` → NOTI-02.
 *  - `POST /api/v1/me/notifications/read`         → NOTI-03, body `{ ids?: long[], all?: bool }`.
 *
 * Tên field trên wire khác với tên gọi nội bộ của FE:
 *  - Item BE có `readAt` (null = chưa đọc) chứ không có boolean `read`.
 *  - Item BE có `type` (UPPER_SNAKE) và `data` (jsonb) chứ không có `kind`/`destination`.
 *
 * FE dùng `base` của workspace (vd `/restaurant`, `/moderation`) để dựng link
 * nội bộ, nên `destination` được suy ra từ `type` + `data` chứ không lấy từ BE.
 */

/** Item thông báo đúng như BE trả về (JSON camelCase theo mặc định ASP.NET Core). */
export interface NotificationWireDto {
  id: number;
  /** Loại thông báo, UPPER_SNAKE (vd "BLOG_COMMENTED", "MENU_APPROVED"). */
  type: string;
  title: string;
  body: string | null;
  /** jsonb của BE: định danh đối tượng liên quan, vd `{ blog_id: 12 }`. */
  data: Record<string, unknown> | null;
  /** null = chưa đọc. */
  readAt: string | null;
  createdAt: string;
}

/** Response của NOTI-01. */
export interface NotificationListWireDto {
  items: NotificationWireDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  unreadCount: number;
}

/** Response của NOTI-02. */
export interface NotificationUnreadWireDto {
  unreadCount: number;
}

/** Response của NOTI-03. */
export interface MarkNotificationsReadWireDto {
  updated: number;
}

/** Loại thông báo mà FE dùng để chọn icon/tone. */
export type NotificationKind =
  | "submission_approved"
  | "submission_rejected"
  | "submission_changes"
  | "social"
  | "roadmap"
  | "system";

/** View model dùng trong UI. */
export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  /** ISO 8601 string (giữ nguyên từ BE). */
  createdAt: string;
  read: boolean;
  /** Slug tương đối trong workspace, vd "verification" / "roadmaps/ha-noi". */
  destination?: string;
  /** Nhóm thông báo dùng để chọn icon + tone. */
  kind?: NotificationKind;
  /** Tuỳ chọn, vd tên actor. */
  actor?: { displayName: string; avatarUrl?: string | null };
}

/** Response của NOTI-01 đã ánh xạ sang view model. */
export interface NotificationListResponse {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  unreadCount: number;
}

/** Response của NOTI-02. */
export interface NotificationUnreadResponse {
  unreadCount: number;
}

/** Body nội bộ của FE (không phải wire DTO). */
export interface NotificationReadRequest {
  notificationIds?: number[];
  /** Đánh dấu tất cả là đã đọc. */
  markAll?: boolean;
}

/** Response của NOTI-03. */
export interface NotificationReadResponse {
  updated: number;
}

/** Loại BE → nhóm hiển thị của FE. */
const KIND_BY_TYPE: Record<string, NotificationKind> = {
  VERIFICATION_APPROVED: "submission_approved",
  VERIFICATION_REJECTED: "submission_rejected",
  VERIFICATION_NEEDS_MORE_INFO: "submission_changes",
  MENU_APPROVED: "submission_approved",
  MENU_REJECTED: "submission_rejected",
  BLOG_COMMENTED: "social",
  BLOG_LIKED: "social",
  REVIEW_REPLIED: "social",
  RESTAURANT_REVIEWED: "social",
  REPORT_RESOLVED: "system",
  ACCOUNT_SANCTIONED: "system",
  ROADMAP_GENERATED: "roadmap",
  RESTAURANT_SHOWN: "system",
  RESTAURANT_HIDDEN: "system",
  RESTAURANT_SUSPENDED: "system",
};

/** Đọc một id dương trong `data` jsonb của BE (vd `blog_id`, `roadmap_id`). */
function dataId(
  data: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!data) return null;
  const value = data[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0)
    return null;
  return value;
}

/**
 * Đường dẫn nội bộ (tương đối so với `base` của workspace) mở khi bấm vào
 * thông báo. Trả `undefined` khi BE không cung cấp đủ định danh — UI sẽ giữ
 * người dùng ở trang thông báo thay vì dẫn tới trang không tồn tại.
 */
export function notificationDestination(
  type: string,
  data: Record<string, unknown> | null,
): string | undefined {
  switch (type) {
    case "VERIFICATION_APPROVED":
    case "VERIFICATION_REJECTED":
    case "VERIFICATION_NEEDS_MORE_INFO":
      return "verification";
    case "MENU_APPROVED":
    case "MENU_REJECTED":
      return "menu";
    case "BLOG_COMMENTED":
    case "BLOG_LIKED": {
      const blogId = dataId(data, "blog_id");
      return blogId ? `guides/${blogId}` : undefined;
    }
    case "REVIEW_REPLIED":
    case "RESTAURANT_REVIEWED": {
      const restaurantId = dataId(data, "restaurant_id");
      return restaurantId ? `restaurants/${restaurantId}` : undefined;
    }
    case "ROADMAP_GENERATED": {
      const roadmapId = dataId(data, "roadmap_id");
      return roadmapId ? `roadmaps/${roadmapId}` : "roadmaps";
    }
    default:
      return undefined;
  }
}

/** Ánh xạ item BE → view model của FE. */
export function toNotificationItem(
  wire: NotificationWireDto,
): NotificationItem {
  const kind = KIND_BY_TYPE[wire.type];
  const destination = notificationDestination(wire.type, wire.data);
  return {
    id: wire.id,
    title: wire.title,
    body: wire.body ?? "",
    createdAt: wire.createdAt,
    read: wire.readAt !== null,
    ...(destination ? { destination } : {}),
    ...(kind ? { kind } : {}),
  };
}

/** Ánh xạ response NOTI-01 → view model. */
export function toNotificationList(
  wire: NotificationListWireDto,
): NotificationListResponse {
  return {
    items: wire.items.map(toNotificationItem),
    page: wire.page,
    pageSize: wire.pageSize,
    totalItems: wire.totalItems,
    totalPages: wire.totalPages,
    unreadCount: wire.unreadCount,
  };
}
