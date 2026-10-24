"use client";
import { fireAndForget } from "@/shared/api/fire-and-forget";

/**
 * NotificationService — abstraction để giao diện không phụ thuộc
 * vào cách dữ liệu được lấy về (mock hay BE).
 *
 * Hỗ trợ 3 nguồn, theo thứ tự ưu tiên:
 *   1. Caller inject trực tiếp qua prop `service={...}`.
 *   2. `createNotificationService({ force: "mock" })` — dùng mock cố định.
 *   3. Singleton mặc định — gọi BE, fallback mock nếu lỗi / 401.
 */

export type NotificationKind =
  | "submission_approved"
  | "submission_rejected"
  | "submission_changes"
  | "social"
  | "roadmap"
  | "system";

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

export interface NotificationListResponse {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  unreadCount: number;
}

export interface NotificationUnreadResponse {
  unreadCount: number;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  /** Lọc trạng thái đã đọc / chưa đọc. */
  read?: boolean;
}

export interface NotificationReadRequest {
  notificationIds?: number[];
  /** Đánh dấu tất cả là đã đọc. */
  markAll?: boolean;
}

export interface NotificationReadResponse {
  updated: number;
}

export interface NotificationService {
  list(query?: NotificationListQuery): Promise<NotificationListResponse>;
  unreadCount(): Promise<NotificationUnreadResponse>;
  markRead(request: NotificationReadRequest): Promise<NotificationReadResponse>;
}

export class UnavailableNotificationError extends Error {
  constructor() {
    super(
      "Nghiệp vụ thông báo chưa có hợp đồng API. Dữ liệu thực chưa khả dụng.",
    );
  }
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: "Bài nộp thực đơn đã được duyệt",
    body: "Bản nộp #128 với 6 món đã được phê duyệt. Món mới sẽ xuất hiện trong trang nhà hàng sau ít phút.",
    createdAt: "2026-10-20T09:12:00+07:00",
    read: false,
    destination: "menu",
    kind: "submission_approved",
  },
  {
    id: 2,
    title: "Lịch trình “Hà Nội 3N2Đ” đã tạo thành công",
    body: "Trợ lý đã soạn xong lộ trình ăn uống 3 ngày tại Hà Nội theo sở thích của bạn. Bấm để xem chi tiết lịch trình.",
    createdAt: "2026-10-20T08:30:00+07:00",
    read: false,
    destination: "roadmaps/ha-noi-3n2d",
    kind: "roadmap",
  },
  {
    id: 3,
    title: "Có người bình luận trên cẩm nang của bạn",
    body: "Minh Anh đã bình luận: “Quán này view đẹp thật, đi nhóm 4 người rất hợp.”",
    createdAt: "2026-10-19T22:40:00+07:00",
    read: false,
    kind: "social",
    actor: { displayName: "Minh Anh" },
    destination: "guides/an-giang-3-ngay",
  },
  {
    id: 4,
    title: "Bài nộp cần chỉnh sửa",
    body: "Bản nộp #127 yêu cầu chỉnh sửa: cập nhật giá món chính và bổ sung ảnh bìa.",
    createdAt: "2026-10-19T15:08:00+07:00",
    read: false,
    destination: "menu",
    kind: "submission_changes",
  },
  {
    id: 5,
    title: "Có món mới trong lộ trình Hà Nội",
    body: "Trợ lý vừa gợi ý thêm 2 món vào ngày 3 theo khẩu vị bạn đã lưu.",
    createdAt: "2026-10-19T08:25:00+07:00",
    read: true,
    destination: "roadmaps/ha-noi",
    kind: "roadmap",
  },
  {
    id: 6,
    title: "Xác minh nhà hàng đã hoàn tất",
    body: "Hồ sơ xác minh của quán Bếp Nhà đã được duyệt. Trạng thái hiển thị đã chuyển sang Đã xác minh.",
    createdAt: "2026-10-18T11:00:00+07:00",
    read: true,
    destination: "verification",
    kind: "submission_approved",
  },
  {
    id: 7,
    title: "Lịch ăn của bạn đã sẵn sàng",
    body: "Trợ lý đã soạn xong lịch ăn 3 ngày tại Hà Nội, bạn có thể mở để xem chi tiết.",
    createdAt: "2026-10-17T18:42:00+07:00",
    read: true,
    destination: "roadmaps/ha-noi",
    kind: "roadmap",
  },
  {
    id: 8,
    title: "Bảo trì hệ thống định kỳ",
    body: "Hệ thống sẽ bảo trì từ 02:00 đến 03:00 sáng 21/10. Một số tính năng có thể gián đoạn.",
    createdAt: "2026-10-17T10:00:00+07:00",
    read: true,
    kind: "system",
  },
  {
    id: 9,
    title: "Có đánh giá mới cho nhà hàng của bạn",
    body: "Quốc Bảo vừa để lại đánh giá 5⭐ cho “Bếp Nhà — Cần Thơ”: “Phục vụ nhiệt tình, món ăn đậm vị miền Tây.”",
    createdAt: "2026-10-20T10:45:00+07:00",
    read: false,
    destination: "reviews/bep-nha-can-tho",
    kind: "social",
    actor: { displayName: "Quốc Bảo" },
  },
  {
    id: 10,
    title: "Có người trả lời đánh giá của bạn",
    body: "Chủ quán đã phản hồi đánh giá của bạn tại “Phở Thìn”: “Cảm ơn bạn đã ghé, hẹn gặp lại lần sau!”",
    createdAt: "2026-10-19T20:15:00+07:00",
    read: true,
    destination: "reviews/pho-thin",
    kind: "social",
  },
];

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function paginate(
  source: NotificationItem[],
  query: NotificationListQuery = {},
): NotificationListResponse {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));
  const filtered =
    typeof query.read === "boolean"
      ? source.filter((n) => n.read === query.read)
      : source;
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    unreadCount: source.filter((n) => !n.read).length,
  };
}

/**
 * Service mock chạy hoàn toàn trong bộ nhớ. Cho phép đánh dấu đã đọc
 * trong phiên hiện tại.
 */
export function createMockNotificationService(
  seed: NotificationItem[] = MOCK_NOTIFICATIONS,
): NotificationService {
  let store: NotificationItem[] = seed.map((n) => ({ ...n }));
  return {
    async list(query) {
      return delay(paginate(store, query));
    },
    async unreadCount() {
      return delay({ unreadCount: store.filter((n) => !n.read).length });
    },
    async markRead(request) {
      if (request.markAll) {
        const updated = store.filter((n) => !n.read).length;
        store = store.map((n) => ({ ...n, read: true }));
        return delay({ updated });
      }
      const ids = new Set(request.notificationIds ?? []);
      let updated = 0;
      store = store.map((n) => {
        if (ids.has(n.id) && !n.read) {
          updated += 1;
          return { ...n, read: true };
        }
        return n;
      });
      return delay({ updated });
    },
  };
}

/**
 * Service gọi BE (NOTI-01 / NOTI-02 / NOTI-03). BE đang chạy cục bộ,
 * frontend sẽ ủy quyền qua `/api/backend/me/notifications...`.
 *
 * Lưu ý: tuyến hiện tại của dự án dùng rewrite tới
 * `/api/v1/me/notifications...`, nên ta gọi qua `/api/backend/me/notifications...`
 * cho bản live (giống cơ chế `me`). Trong demo mode, FE gọi thẳng
 * `/api/backend/me/...` cũng hoạt động vì Next.js rewrite về BE.
 */
export function createLiveNotificationService(
  fetcher: typeof fetch = fetch,
): NotificationService {
  async function path(p: string, query: Record<string, unknown> = {}) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      search.set(k, String(v));
    }
    const q = search.toString();
    return `/api/backend/me/notifications${p}${q ? `?${q}` : ""}`;
  }

  async function unwrap<T>(res: Response): Promise<T> {
    // Tương thích cả 2 dạng: ApiResponse<T> và { data }
    const body = (await res.json().catch(() => null)) as {
      data?: T;
      success?: boolean;
      items?: NotificationItem[];
      unreadCount?: number;
      updated?: number;
      page?: number;
      pageSize?: number;
      totalItems?: number;
      totalPages?: number;
    } | null;
    if (!body) throw new UnavailableNotificationError();
    if (body.data !== undefined && body.data !== null) return body.data;
    // Fallback: response trần
    return body as unknown as T;
  }

  return {
    async list(query = {}) {
      const url = await path("", {
        page: query.page,
        pageSize: query.pageSize,
        read: query.read,
      });
      const res = await fetcher(url, { credentials: "include" });
      if (!res.ok) throw new UnavailableNotificationError();
      return unwrap<NotificationListResponse>(res);
    },
    async unreadCount() {
      const res = await fetcher(
        await path("/unread-count"),
        { credentials: "include" },
      );
      if (!res.ok) throw new UnavailableNotificationError();
      return unwrap<NotificationUnreadResponse>(res);
    },
    async markRead(request) {
      const res = await fetcher(await path("/read"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationIds: request.notificationIds,
          markAll: request.markAll,
        }),
      });
      if (!res.ok) throw new UnavailableNotificationError();
      return unwrap<NotificationReadResponse>(res);
    },
  };
}

/**
 * Singleton mặc định: thử gọi BE trước, nếu không khả dụng (404/503/…) thì
 * tự rơi về mock để UI vẫn hiển thị dữ liệu khi DB chưa sẵn sàng.
 *
 * Khởi tạo lười — chỉ tạo mock khi gọi hàm đầu tiên thất bại.
 */
export const notificationService: NotificationService = (() => {
  let mode: "live" | "mock" | null = null;
  let live: NotificationService | null = null;
  let mock: NotificationService | null = null;

  function getMock(): NotificationService {
    if (!mock) mock = createMockNotificationService();
    return mock;
  }
  function getLive(): NotificationService {
    if (!live) live = createLiveNotificationService();
    return live;
  }

  async function tryLive<T>(fn: () => Promise<T>): Promise<T> {
    if (mode === "mock") throw new UnavailableNotificationError();
    try {
      const result = await fn();
      mode = "live";
      return result;
    } catch (err) {
      // Lần đầu thất bại → khoá sang mock
      if (mode === null) mode = "mock";
      throw err;
    }
  }

  return {
    async list(query) {
      if (mode === "mock") return getMock().list(query);
      return tryLive(() => getLive().list(query)).catch(() =>
        getMock().list(query),
      );
    },
    async unreadCount() {
      if (mode === "mock") return getMock().unreadCount();
      return tryLive(() => getLive().unreadCount()).catch(() =>
        getMock().unreadCount(),
      );
    },
    async markRead(request) {
      // markRead: gọi live để đồng bộ DB, đồng thời cập nhật mock local
      // để UI optimistic không bị giật nếu BE trả chậm/lỗi.
      if (mode === "mock") {
        const res = await getMock().markRead(request);
        fireAndForget("notifications.markRead", () =>
          getLive().markRead(request),
        );
        return res;
      }
      try {
        const res = await getLive().markRead(request);
        if (mode === null) mode = "live";
        return res;
      } catch {
        if (mode === null) mode = "mock";
        return getMock().markRead(request);
      }
    },
  };
})();

export function createNotificationService(opts: {
  force?: "mock" | "live";
}): NotificationService {
  if (opts.force === "mock") return createMockNotificationService();
  if (opts.force === "live") return createLiveNotificationService();
  return notificationService;
}
