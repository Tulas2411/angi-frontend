/**
 * Traveler operations that are authenticated but not owner-scoped.
 *
 * The backend requires a signed-in traveler, so the proxy runs `withAuth` and
 * forwards the access token; it never lets a guest through.
 *
 * Covered operations (API Design v1.8, sheet "Backend API"), each confirmed
 * against a backend controller:
 *   - PREF-02 `POST me/preference-survey`        (201 Created)
 *   - PREF-03 `POST me/preference-survey/skip`   (201 Created)
 *   - NOTI-01 `GET me/notifications`              (200 OK)
 *   - NOTI-02 `GET me/notifications/unread-count` (200 OK)
 *   - NOTI-03 `POST me/notifications/read`        (200 OK)
 *   - BLOG-04 `POST blogs`                       (201 Created)
 *   - RM-12 `GET roadmaps/{roadmapId}/items/{itemId}` (200 OK)
 *
 * BLOG-01..03 and BLOG-05..11, REP-02 and RM-08 are still missing from the
 * backend controllers, so they stay out of the allowlist until they exist.
 */

import type { OperationMeta } from "./public-proxy";

/** A positive `long` id: the path can never reach another backend route. */
const id = String.raw`[1-9]\d{0,17}`;

const roadmapItem = new RegExp(`^roadmaps/${id}/items/${id}$`);

export function travelerOperation(
  method: string,
  endpoint: string,
): OperationMeta | null {
  // PREF-02 Set Up Preference Profile — 201 Created
  if (method === "POST" && endpoint === "me/preference-survey")
    return { body: true, status: 201 };

  // PREF-03 Skip Preference Profile — 201 Created, no body
  if (method === "POST" && endpoint === "me/preference-survey/skip")
    return { body: false, status: 201 };

  // NOTI-01 View Notifications — 200 OK
  if (method === "GET" && endpoint === "me/notifications")
    return { body: false, status: 200 };

  // NOTI-02 Unread Notification Count — 200 OK
  if (method === "GET" && endpoint === "me/notifications/unread-count")
    return { body: false, status: 200 };

  // NOTI-03 Mark Notification as Read — 200 OK
  if (method === "POST" && endpoint === "me/notifications/read")
    return { body: true, status: 200 };

  // BLOG-04 Write Blog / Share My Roadmap — 201 Created
  if (method === "POST" && endpoint === "blogs")
    return { body: true, status: 201 };

  // RM-12 View Roadmap Item Detail — 200 OK
  if (method === "GET" && roadmapItem.test(endpoint))
    return { body: false, status: 200 };

  return null;
}
