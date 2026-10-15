import { backend, getSession, withAuth } from "@/features/auth/server";
import { ApiError } from "@/shared/api/error";
import { checkOrigin, fail, ok, readJson } from "@/shared/api/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
// Exact operations verified against API Design v1.8 and the sibling BE checkout.
const allowedEndpoints = new Set([
  "GET me",
  "PATCH me",
  "PUT me/password",
  "GET owner/restaurant",
  "PATCH owner/restaurant",
  "PUT owner/restaurant/business-hours",
  "PUT owner/restaurant/operating-status",
  "POST owner/restaurant",
  "POST media",
]);

async function handle(request: Request, context: Context) {
  const session = await getSession();
  try {
    const { path } = await context.params;
    const endpoint = path.join("/");
    if (!allowedEndpoints.has(`${request.method} ${endpoint}`)) {
      throw new ApiError(
        404,
        "ROUTE_NOT_FOUND",
        "Endpoint chưa được cấu hình.",
      );
    }
    if (request.method !== "GET") checkOrigin(request);
    let body: unknown;
    if (request.method !== "GET") {
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
            endpoint === "owner/restaurant/business-hours" ||
            endpoint === "owner/restaurant/operating-status") &&
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
      request.method === "POST" ? 201 : 200,
    );
  } catch (error) {
    return fail(error, session);
  }
}
export const GET = handle;
export const PATCH = handle;
export const PUT = handle;
export const POST = handle;
