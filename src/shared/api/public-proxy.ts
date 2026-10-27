/**
 * Operations dùng trong fire-and-forget của 6 use case traveler.
 *
 * Pattern giống `ownerMenuOperation`: route handler kiểm tra endpoint có nằm
 * trong danh sách này không. Có 2 loại:
 *
 *  - `allowGuest: true`  — bỏ qua `withAuth`, gọi `backend()` không cần token.
 *                          Dùng cho các endpoint BE đã đánh `[AllowAnonymous]`
 *                          (browse dish, dish detail, restaurant, restaurant menu,
 *                          restaurant reviews).
 *  - `allowGuest: false` — vẫn chạy `withAuth` để có access token. Dùng cho
 *                          endpoint BE có `[Authorize(Roles=…)]` (roll dish,
 *                          impressions, change password, …).
 *
 *  - `body: false`       — endpoint không cần body, bỏ qua `readJson`.
 *  - `status: N`         — status code trả về thay vì mặc định 200/201.
 */

export interface OperationMeta {
  body?: boolean;
  status: number;
  /** Cho phép gọi không cần session (GUEST). Mặc định false. */
  allowGuest?: boolean;
}

export function publicOperation(
  method: string,
  endpoint: string,
): OperationMeta | null {
  // F-12 Browse Dish — [AllowAnonymous]
  if (method === "GET" && endpoint === "dishes")
    return { body: false, status: 200, allowGuest: true };

  // F-13 Dish Detail — [AllowAnonymous]
  if (method === "GET" && /^dishes\/[1-9]\d*$/.test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant list — [AllowAnonymous] via class-level absence
  if (method === "GET" && endpoint === "restaurants")
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant detail — anonymous
  if (method === "GET" && /^restaurants\/[1-9]\d*$/.test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant menu — anonymous
  if (method === "GET" && /^restaurants\/[1-9]\d*\/menu$/.test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant reviews — anonymous
  if (method === "GET" && /^restaurants\/[1-9]\d*\/reviews$/.test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // CAT-02 Tags — public (filters of the dish list, also used by owner and roadmap screens)
  if (method === "GET" && endpoint === "tags")
    return { body: false, status: 200, allowGuest: true };

  // REV-01 Feedback Restaurant — [Authorize(Roles = "TRAVELER")], 201 Created
  if (method === "POST" && /^restaurants\/[1-9]\d*\/reviews$/.test(endpoint))
    return { body: true, status: 201, allowGuest: false };

  // REP-01 Report Restaurant — [Authorize(Roles = "TRAVELER")], 201 Created
  if (method === "POST" && /^restaurants\/[1-9]\d*\/reports$/.test(endpoint))
    return { body: true, status: 201, allowGuest: false };

  // F-18 Roll Dish — [Authorize(Roles = "TRAVELER")] → cần session
  if (method === "POST" && endpoint === "dishes/roll")
    return { body: true, status: 200, allowGuest: false };

  // F-18 Impressions — [Authorize(Roles = "TRAVELER")] → cần session
  if (method === "POST" && endpoint === "impressions")
    return { body: true, status: 202, allowGuest: false };

  return null;
}
