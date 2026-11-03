/**
 * F-66 Manage Permission: the exact Admin operations allowed through the same-origin proxy.
 * Verified against API Design v1.8 and the BE `PermissionsController` / `ModsController`:
 * ADM-P1 `GET admin/permissions`, ADM-P2 `GET admin/mods/{userId}/permissions`, ADM-P3
 * `PUT admin/mods/{userId}/permissions`, ADM-P4 `PUT admin/roles/MOD/permissions`, and ADM-M1
 * `GET admin/mods` to pick the Mod. `userId` is a positive `int`.
 */
const userId = String.raw`[1-9]\d{0,9}`;

export function adminPermissionsOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "admin/permissions")
    return { body: false, status: 200 };
  if (method === "GET" && endpoint === "admin/mods")
    return { body: false, status: 200 };
  if (
    method === "GET" &&
    new RegExp(`^admin/mods/${userId}/permissions$`).test(endpoint)
  )
    return { body: false, status: 200 };
  if (
    method === "PUT" &&
    new RegExp(`^admin/mods/${userId}/permissions$`).test(endpoint)
  )
    return { body: true, status: 200 };
  if (method === "PUT" && endpoint === "admin/roles/MOD/permissions")
    return { body: true, status: 200 };
  return null;
}

/**
 * F-65 Manage Mod: ADM-M2 `POST admin/mods` (201 Created), ADM-M3 `GET admin/mods/{userId}` and
 * ADM-M4 `PATCH admin/mods/{userId}`. ADM-M1 (the list) is allowed above with the permissions.
 */
export function adminModsOperation(method: string, endpoint: string) {
  if (method === "POST" && endpoint === "admin/mods")
    return { body: true, status: 201 };
  if (method === "GET" && new RegExp(`^admin/mods/${userId}$`).test(endpoint))
    return { body: false, status: 200 };
  if (method === "PATCH" && new RegExp(`^admin/mods/${userId}$`).test(endpoint))
    return { body: true, status: 200 };
  return null;
}

/**
 * F-63 View Dashboard: ADM-D1 `GET admin/dashboard/summary`, ADM-D2 `GET admin/dashboard/timeseries`,
 * ADM-D3 `GET admin/dashboard/top` and OPS-01 `GET admin/outbox` (read only, query strings only).
 */
export function adminDashboardOperation(method: string, endpoint: string) {
  if (
    method === "GET" &&
    [
      "admin/dashboard/summary",
      "admin/dashboard/timeseries",
      "admin/dashboard/top",
      "admin/outbox",
    ].includes(endpoint)
  )
    return { body: false, status: 200 };
  return null;
}
