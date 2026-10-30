/**
 * Exact MOD-RP1..MOD-RP4 operations.
 *
 * Only the four report operations of API Design v1.8 are allowed through the
 * same-origin proxy. Ids are positive `long` values, so a path can never reach
 * another backend route.
 */
const id = String.raw`[1-9]\d{0,17}`;

/** MOD-RP1 needs a target type; the backend rejects the request without it. */
export function moderationReportsOperation(
  method: string,
  endpoint: string,
) {
  if (method === "GET" && endpoint === "mod/reports")
    return { body: false, status: 200 };
  if (method === "GET" && new RegExp(`^mod/reports/${id}$`).test(endpoint))
    return { body: false, status: 200 };
  if (method === "POST" && new RegExp(`^mod/reports/${id}/claim$`).test(endpoint))
    return { body: false, status: 200 };
  if (method === "POST" && new RegExp(`^mod/reports/${id}/resolve$`).test(endpoint))
    return { body: true, status: 200 };
  return null;
}

/** Only MOD and ADMIN accounts may reach the moderation endpoints. */
export function isModeratorRole(role: string | undefined): boolean {
  return role === "MOD" || role === "ADMIN";
}
