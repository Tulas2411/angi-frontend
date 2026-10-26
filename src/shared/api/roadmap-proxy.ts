/**
 * Roadmap operations with an id in the path, allowed through the same-origin proxy.
 * Verified against API Design v1.8: RM-03 `GET roadmaps/{roadmapId}`, RM-04 `PATCH
 * roadmaps/{roadmapId}`, RM-06 `GET roadmaps/{roadmapId}/suggestions`, RM-07 `POST
 * roadmaps/{roadmapId}/days/{dayId}/items`, RM-08 `PATCH roadmaps/{roadmapId}/items/{itemId}`,
 * RM-09 `DELETE roadmaps/{roadmapId}/items/{itemId}`,
 * RM-10 `POST roadmaps/{roadmapId}/generate`, RM-11 `GET
 * roadmaps/{roadmapId}/generation-jobs/{jobId}` and RM-14 `GET
 * roadmaps/{roadmapId}/days/{dayId}/route`. Ids are positive `long` values, so the path can
 * never reach another backend route.
 */
const id = String.raw`[1-9]\d{0,17}`;
const operations: [method: string, path: RegExp][] = [
  ["GET", new RegExp(`^roadmaps/${id}$`)],
  ["PATCH", new RegExp(`^roadmaps/${id}$`)],
  ["GET", new RegExp(`^roadmaps/${id}/suggestions$`)],
  ["POST", new RegExp(`^roadmaps/${id}/days/${id}/items$`)],
  ["PATCH", new RegExp(`^roadmaps/${id}/items/${id}$`)],
  ["DELETE", new RegExp(`^roadmaps/${id}/items/${id}$`)],
  ["POST", new RegExp(`^roadmaps/${id}/generate$`)],
  ["GET", new RegExp(`^roadmaps/${id}/generation-jobs/${id}$`)],
  ["GET", new RegExp(`^roadmaps/${id}/days/${id}/route$`)],
];

/** RM-10 answers `202 Accepted` (a job was queued); the other writes keep the 200/201 defaults. */
export function roadmapOperationStatus(method: string, endpoint: string) {
  return method === "POST" &&
    new RegExp(`^roadmaps/${id}/generate$`).test(endpoint)
    ? 202
    : undefined;
}

/** RM-09 has no request body: the proxy must not demand JSON from a DELETE. */
export function roadmapOperationHasBody(method: string) {
  return method !== "GET" && method !== "DELETE";
}

export function roadmapOperation(method: string, endpoint: string) {
  return operations.some(
    ([allowed, path]) => allowed === method && path.test(endpoint),
  );
}
