/**
 * Roadmap operations with an id in the path, allowed through the same-origin proxy.
 * Verified against API Design v1.8: RM-03 `GET roadmaps/{roadmapId}`, RM-04 `PATCH
 * roadmaps/{roadmapId}` and RM-14 `GET roadmaps/{roadmapId}/days/{dayId}/route`. Ids are
 * positive `long` values, so the path can never reach another backend route.
 */
const id = String.raw`[1-9]\d{0,17}`;
const operations: [method: string, path: RegExp][] = [
  ["GET", new RegExp(`^roadmaps/${id}$`)],
  ["PATCH", new RegExp(`^roadmaps/${id}$`)],
  ["GET", new RegExp(`^roadmaps/${id}/days/${id}/route$`)],
];

export function roadmapOperation(method: string, endpoint: string) {
  return operations.some(
    ([allowed, path]) => allowed === method && path.test(endpoint),
  );
}
