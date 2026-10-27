/**
 * Exact NOTI-01..03 operations (`MeNotificationController`, `[Authorize]` mọi role).
 *
 * Pattern giống `ownerMenuOperation`: route handler kiểm tra endpoint có nằm
 * trong danh sách này không. Cả ba đường dẫn là hằng số nên không có tham số
 * do người gọi điều khiển — không thể chạm tới route backend khác.
 *
 *  - NOTI-01 `GET  me/notifications`            — danh sách thông báo có phân trang.
 *  - NOTI-02 `GET  me/notifications/unread-count` — số thông báo chưa đọc (badge).
 *  - NOTI-03 `POST me/notifications/read`       — đánh dấu đã đọc (body JSON).
 */
export function notificationOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "me/notifications")
    return { body: false, status: 200 };
  if (method === "GET" && endpoint === "me/notifications/unread-count")
    return { body: false, status: 200 };
  // NOTI-03 trả 200 OK (số thông báo vừa chuyển sang đã đọc), không phải 201.
  if (method === "POST" && endpoint === "me/notifications/read")
    return { body: true, status: 200 };
  return null;
}
