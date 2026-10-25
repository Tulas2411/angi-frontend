/**
 * Blog, bình luận, báo cáo và đánh giá nhà hàng — các thao tác xã hội.
 *
 * Mỗi thao tác đều được đối chiếu với controller thật của backend:
 *   - BLOG-01 `GET blogs`                      (200 OK, ẩn danh)
 *   - BLOG-02 `GET blogs/{blogId}`             (200 OK, ẩn danh)
 *   - BLOG-03 `GET blogs/{blogId}/comments`    (200 OK, ẩn danh)
 *   - BLOG-04 `POST blogs`                    (201 Created, cần đăng nhập)
 *   - BLOG-05 `GET me/blogs`                  (200 OK, cần đăng nhập)
 *   - BLOG-06 `PATCH blogs/{blogId}`          (200 OK, cần đăng nhập)
 *   - BLOG-07 `DELETE blogs/{blogId}`         (200 OK, cần đăng nhập)
 *   - BLOG-10 `POST blogs/{blogId}/comments`  (201 Created, cần đăng nhập)
 *   - BLOG-11 `DELETE blogs/{blogId}/comments/{commentId}` (200 OK, cần đăng nhập)
 *   - REP-02  `POST blogs/{blogId}/reports`   (201 Created, cần đăng nhập)
 *   - REV-01  `POST restaurants/{restaurantId}/reviews`    (201 Created, cần đăng nhập)
 *   - REP-01  `POST restaurants/{restaurantId}/reports`   (201 Created, cần đăng nhập)
 *   - OWN-19  `GET owner/restaurant/reviews` (200 OK, chủ nhà hàng)
 *   - OWN-20  `PUT owner/restaurant/reviews/{reviewId}/reply` (200 OK, chủ nhà hàng)
 *
 * `allowGuest: true` đánh dấu các route mà backend để `[AllowAnonymous]`.
 *
 * Cố ý KHÔNG có BLOG-08 (`PUT blogs/{blogId}/like`) và BLOG-09
 * (`DELETE blogs/{blogId}/like`): like/dislike không thuộc phạm vi nối API
 * lần này. Các route của Mod cũng không có ở đây.
 */

import type { OperationMeta } from "./public-proxy";

/** Một id dương kiểu `long`: đường dẫn không thể lọt sang route khác. */
const id = String.raw`[1-9]\d{0,17}`;

const blog = new RegExp(`^blogs/${id}$`);
const blogComments = new RegExp(`^blogs/${id}/comments$`);
const blogComment = new RegExp(`^blogs/${id}/comments/${id}$`);
const blogReports = new RegExp(`^blogs/${id}/reports$`);
const restaurantReviews = new RegExp(`^restaurants/${id}/reviews$`);
const restaurantReports = new RegExp(`^restaurants/${id}/reports$`);
const ownerReviewReply = new RegExp(`^owner/restaurant/reviews/${id}/reply$`);

export function socialOperation(
  method: string,
  endpoint: string,
): OperationMeta | null {
  // BLOG-01 View Public Blogs — [AllowAnonymous]
  if (method === "GET" && endpoint === "blogs")
    return { body: false, status: 200, allowGuest: true };

  // BLOG-02 View Blog Detail — [AllowAnonymous]
  if (method === "GET" && blog.test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // BLOG-03 View Blog Comments — [AllowAnonymous]
  if (method === "GET" && blogComments.test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // BLOG-04 Write Blog / Share My Roadmap — 201 Created
  if (method === "POST" && endpoint === "blogs")
    return { body: true, status: 201, allowGuest: false };

  // BLOG-05 View My Blogs — cần đăng nhập
  if (method === "GET" && endpoint === "me/blogs")
    return { body: false, status: 200, allowGuest: false };

  // BLOG-06 Edit Blog — 200 OK
  if (method === "PATCH" && blog.test(endpoint))
    return { body: true, status: 200, allowGuest: false };

  // BLOG-07 Delete Blog — 200 OK, không có body
  if (method === "DELETE" && blog.test(endpoint))
    return { body: false, status: 200, allowGuest: false };

  // BLOG-10 Comment on Blog — 201 Created
  if (method === "POST" && blogComments.test(endpoint))
    return { body: true, status: 201, allowGuest: false };

  // BLOG-11 Delete Blog Comment — 200 OK, không có body
  if (method === "DELETE" && blogComment.test(endpoint))
    return { body: false, status: 200, allowGuest: false };

  // REP-02 Report Blog — 201 Created
  if (method === "POST" && blogReports.test(endpoint))
    return { body: true, status: 201, allowGuest: false };

  // REV-01 Write Restaurant Review — 201 Created
  if (method === "POST" && restaurantReviews.test(endpoint))
    return { body: true, status: 201, allowGuest: false };

  // REP-01 Report Restaurant — 201 Created
  if (method === "POST" && restaurantReports.test(endpoint))
    return { body: true, status: 201, allowGuest: false };

  // OWN-19 View Owner Reviews — 200 OK
  if (method === "GET" && endpoint === "owner/restaurant/reviews")
    return { body: false, status: 200, allowGuest: false };

  // OWN-20 Reply to Review — 200 OK
  if (method === "PUT" && ownerReviewReply.test(endpoint))
    return { body: true, status: 200, allowGuest: false };

  return null;
}
