import { backend, getSession, withAuth } from "@/features/auth/server";
import { ApiError } from "@/shared/api/error";
import { checkOrigin, fail, ok, readJson } from "@/shared/api/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
// Account endpoints from API Design v1.8; the current BE does not implement them yet.
const allowedEndpoints = new Set(["GET me", "PATCH me", "PUT me/password"]);

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
    const body = request.method === "GET" ? undefined : await readJson(request);
    const query = new URL(request.url).search;
    return ok(
      await withAuth(session, (auth) =>
        backend<unknown>(`${endpoint}${query}`, {
          method: request.method,
          body,
          token: auth.accessToken,
        }),
      ),
    );
  } catch (error) {
    return fail(error, session);
  }
}
export const GET = handle;
export const PATCH = handle;
export const PUT = handle;
