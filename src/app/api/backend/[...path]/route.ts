import { backend, getSession, withAuth } from "@/features/auth/server";
import { ApiError } from "@/shared/api/error";
import { checkOrigin, fail, ok, readJson } from "@/shared/api/http";
import { ownerMenuOperation } from "@/shared/api/owner-menu-proxy";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
// Exact operations used by the integrated screens, verified against API Design
// v1.8 and the backend implementation: account (ME-01..03), media, tags and the
// Restaurant Owner workspace.
const allowedEndpoints = new Set([
  "GET me",
  "PATCH me",
  "PUT me/password",
  "GET owner/restaurant",
  "PATCH owner/restaurant",
  "PUT owner/restaurant/business-hours",
  "PUT owner/restaurant/operating-status",
  "POST owner/restaurant",
  "POST owner/restaurant/verifications",
  "GET owner/restaurant/verifications",
  "POST media",
  "GET tags",
]);

async function handle(request: Request, context: Context) {
  const session = await getSession();
  try {
    const { path } = await context.params;
    const endpoint = path.join("/");
    const menuOperation = ownerMenuOperation(request.method, endpoint);
    const resubmission =
      request.method === "POST" &&
      /^owner\/restaurant\/verifications\/[1-9]\d*\/resubmit$/.test(endpoint);
    if (
      !allowedEndpoints.has(`${request.method} ${endpoint}`) &&
      !resubmission &&
      !menuOperation
    ) {
      throw new ApiError(
        404,
        "ROUTE_NOT_FOUND",
        "Endpoint chưa được cấu hình.",
      );
    }
    if (request.method !== "GET") checkOrigin(request);
    let body: unknown;
    if (request.method !== "GET" && menuOperation?.body !== false) {
      if (endpoint === "media") {
        try {
          body = await request.formData();
        } catch {
          throw new ApiError(
            400,
            "BAD_REQUEST",
            "Tệp tải lên phải dùng multipart/form-data.",
          );
        }
      } else body = await readJson(request);
    }
    const query = new URL(request.url).search;
    return ok(
      await withAuth(session, (auth) => {
        if (
          (endpoint === "owner/restaurant" ||
            endpoint.startsWith("owner/restaurant/")) &&
          auth.user.role !== "RESTAURANT_OWNER"
        )
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Chỉ chủ nhà hàng được thực hiện thao tác này.",
          );
        return backend<unknown>(`${endpoint}${query}`, {
          method: request.method,
          body,
          token: auth.accessToken,
        });
      }),
      menuOperation?.status ?? (request.method === "POST" ? 201 : 200),
    );
  } catch (error) {
    return fail(error, session);
  }
}
export const GET = handle;
export const PATCH = handle;
export const PUT = handle;
export const POST = handle;
export const DELETE = handle;
