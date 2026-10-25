/**
 * Public discovery operations that the same-origin proxy forwards without a
 * session.
 *
 * The backend marks these `[AllowAnonymous]`:
 *   - HOME-01 `GET home`             (token optional: a signed-in traveler also
 *                                     gets the reco-ranked "recommended" block)
 *   - DISH-01 `GET dishes`           (public)
 *   - DISH-02 `GET dishes/{dishId}`  (public)
 *   - REST-01 `GET restaurants`      (public)
 *   - REST-02 `GET restaurants/{id}` (public)
 *   - REST-03 `GET restaurants/{id}/menu`    (public)
 *   - REST-04 `GET restaurants/{id}/reviews` (public)
 *
 * `allowGuest: false` marks the public-but-authenticated operations: the
 * backend still requires a TRAVELER role, so the proxy runs `withAuth` and
 * forwards the access token.
 *
 * Only operations the backend actually implements are listed here. REV-01
 * (write a review) and REP-01 (report a restaurant) are still missing from the
 * backend controllers, so they stay out of the allowlist until they exist.
 */

export interface OperationMeta {
  /** `false` when the endpoint takes no request body, so the proxy skips `readJson`. */
  body?: boolean;
  /** The designed success status; the proxy answers with it. */
  status: number;
  /** `true` when the endpoint may be called without a session. */
  allowGuest?: boolean;
}

/** A positive `long` id: the path can never reach another backend route. */
const id = String.raw`[1-9]\d{0,17}`;

export function publicOperation(
  method: string,
  endpoint: string,
): OperationMeta | null {
  // F-12 Browse Dish — DISH-01
  if (method === "GET" && endpoint === "dishes")
    return { body: false, status: 200, allowGuest: true };

  // F-13 Dish Detail — DISH-02
  if (method === "GET" && new RegExp(`^dishes/${id}$`).test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // HOME-01 View Home Page — the token is optional, so guests may call it.
  if (method === "GET" && endpoint === "home")
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant list — REST-01
  if (method === "GET" && endpoint === "restaurants")
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant detail — REST-02
  if (method === "GET" && new RegExp(`^restaurants/${id}$`).test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant menu — REST-03
  if (method === "GET" && new RegExp(`^restaurants/${id}/menu$`).test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // F-16 Restaurant reviews — REST-04
  if (method === "GET" && new RegExp(`^restaurants/${id}/reviews$`).test(endpoint))
    return { body: false, status: 200, allowGuest: true };

  // F-18 Roll Dish — DISH-03 [Authorize(Roles = "TRAVELER")] → needs a session
  if (method === "POST" && endpoint === "dishes/roll")
    return { body: true, status: 200, allowGuest: false };

  // IMP-01 Impressions — [Authorize(Roles = "TRAVELER")] → needs a session.
  // The backend answers 202 Accepted, not 200.
  if (method === "POST" && endpoint === "impressions")
    return { body: true, status: 202, allowGuest: false };

  return null;
}
