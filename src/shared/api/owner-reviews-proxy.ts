/**
 * Exact OWN-19 and OWN-20 operations (`OwnerRestaurantReviewsController`).
 *
 *  - OWN-19 `GET owner/restaurant/reviews` — paginated reviews of the caller's restaurant.
 *  - OWN-20 `PUT owner/restaurant/reviews/{id}/reply` — create or replace the owner's reply.
 *
 * `{id}` is a positive integer so a caller cannot reach another owner endpoint.
 */
export function ownerReviewsOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "owner/restaurant/reviews")
    return { body: false, status: 200 };
  if (
    method === "PUT" &&
    /^owner\/restaurant\/reviews\/[1-9]\d*\/reply$/.test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}
