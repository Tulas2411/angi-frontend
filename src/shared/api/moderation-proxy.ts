/**
 * Exact MOD-RP1..MOD-RP4 operations.
 *
 * Only the four report operations of API Design v1.8 are allowed through the
 * same-origin proxy. Ids are positive `long` values, so a path can never reach
 * another backend route.
 */
const id = String.raw`[1-9]\d{0,17}`;

/** MOD-RP1 needs a target type; the backend rejects the request without it. */
export function moderationReportsOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "mod/reports")
    return { body: false, status: 200 };
  if (method === "GET" && new RegExp(`^mod/reports/${id}$`).test(endpoint))
    return { body: false, status: 200 };
  if (
    method === "POST" &&
    new RegExp(`^mod/reports/${id}/claim$`).test(endpoint)
  )
    return { body: false, status: 200 };
  if (
    method === "POST" &&
    new RegExp(`^mod/reports/${id}/resolve$`).test(endpoint)
  )
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
  if (
    method === "GET" &&
    new RegExp(`^mod/users/[1-9]\\d{0,9}$`).test(endpoint)
  )
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
  if (method === "PUT" && new RegExp(`^mod/blogs/${id}/status$`).test(endpoint))
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

/**
 * F-57 Review Verification Submission: MOD-V1 `GET mod/verifications`, MOD-V2
 * `GET mod/verifications/{verificationId}` and MOD-V3 `POST mod/verifications/{verificationId}/decision`.
 * The BE controller is `[Authorize(Roles = "MOD")]`, so only a Mod session is sent on.
 */
export function moderationVerificationsOperation(
  method: string,
  endpoint: string,
) {
  if (method === "GET" && endpoint === "mod/verifications")
    return { body: false, status: 200 };
  if (
    method === "GET" &&
    new RegExp(`^mod/verifications/${id}$`).test(endpoint)
  )
    return { body: false, status: 200 };
  if (
    method === "POST" &&
    new RegExp(`^mod/verifications/${id}/decision$`).test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}

/**
 * F-56 Moderate Restaurant: MOD-R1 `GET mod/restaurants`, MOD-R2 `GET mod/restaurants/{restaurantId}`,
 * MOD-R3 `PUT .../moderation-status` and MOD-R4 `PUT mod/dishes/{dishId}/moderation-status`
 * (`dishId` is an `int`). MOD-RP4 goes through `moderationReportsOperation`. MOD and ADMIN.
 */
export function moderationRestaurantsOperation(
  method: string,
  endpoint: string,
) {
  if (method === "GET" && endpoint === "mod/restaurants")
    return { body: false, status: 200 };
  if (method === "GET" && new RegExp(`^mod/restaurants/${id}$`).test(endpoint))
    return { body: false, status: 200 };
  if (
    method === "PUT" &&
    new RegExp(`^mod/restaurants/${id}/moderation-status$`).test(endpoint)
  )
    return { body: true, status: 200 };
  if (
    method === "PUT" &&
    /^mod\/dishes\/[1-9]\d{0,9}\/moderation-status$/.test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}

/**
 * F-58 Review Pending Menu Submission: MOD-M1 `GET mod/menu-submissions`, MOD-M2
 * `GET mod/menu-submissions/{submissionId}`, MOD-M3 `POST .../approve` and MOD-M4
 * `POST .../reject`. The BE controller allows MOD and ADMIN.
 */
export function moderationMenusOperation(method: string, endpoint: string) {
  if (method === "GET" && endpoint === "mod/menu-submissions")
    return { body: false, status: 200 };
  if (
    method === "GET" &&
    new RegExp(`^mod/menu-submissions/${id}$`).test(endpoint)
  )
    return { body: false, status: 200 };
  if (
    method === "POST" &&
    new RegExp(`^mod/menu-submissions/${id}/(approve|reject)$`).test(endpoint)
  )
    return { body: true, status: 200 };
  return null;
}
