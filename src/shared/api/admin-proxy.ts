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
