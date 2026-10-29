/**
 * Exact OWN-19/OWN-20 operations.
 *
 * The owner reads the reviews of their own restaurant and writes one reply per
 * review. The ids are positive `long` values, so a path can never reach another
 * backend route.
 */
const id = String.raw`[1-9]\d{0,17}`;

/** OWN-19 reads a page; OWN-20 writes the reply body and answers 200 OK. */
export function ownerReviewsOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "owner/restaurant/reviews")
    return { body: false, status: 200 };
  if (
    method === "PUT" &&
    new RegExp(`^owner/restaurant/reviews/${id}/reply$`).test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}
