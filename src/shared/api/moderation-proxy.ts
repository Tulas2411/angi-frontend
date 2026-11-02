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

/**
 * MOD-U1..MOD-U4 — user moderation.
 *
 * `GET mod/users` lists accounts, `GET mod/users/{id}` returns the profile with
 * its sanction history, `POST .../sanctions` creates a sanction (201) and
 * `POST .../unban` lifts one (200).
 */
export function moderationUsersOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "mod/users")
    return { body: false, status: 200 };
  if (method === "GET" && new RegExp(`^mod/users/[1-9]\\d{0,9}$`).test(endpoint))
    return { body: false, status: 200 };
  if (
    method === "POST" &&
    new RegExp(`^mod/users/[1-9]\\d{0,9}/sanctions$`).test(endpoint)
  )
    return { body: true, status: 201 };
  if (
    method === "POST" &&
    new RegExp(`^mod/users/[1-9]\\d{0,9}/unban$`).test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}

/**
 * MOD-B1..MOD-B3 — community content moderation.
 *
 * `GET mod/blogs` lists blogs in every moderation state, `PUT
 * mod/blogs/{id}/status` hides/removes/restores a blog and `PUT
 * mod/blog-comments/{id}/status` does the same for one comment.
 */
export function moderationBlogsOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "mod/blogs")
    return { body: false, status: 200 };
  if (
    method === "PUT" &&
    new RegExp(`^mod/blogs/${id}/status$`).test(endpoint)
  )
    return { body: true, status: 200 };
  if (
    method === "PUT" &&
    new RegExp(`^mod/blog-comments/${id}/status$`).test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}

/** Only MOD and ADMIN accounts may reach the moderation endpoints. */
export function isModeratorRole(role: string | undefined): boolean {
  return role === "MOD" || role === "ADMIN";
}
