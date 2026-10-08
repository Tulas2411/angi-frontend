import {
  backend,
  destroySession,
  getSession,
  readAuth,
  refreshSession,
  saveAuth,
  withAuth,
} from "@/features/auth/server";
import type { AuthResultDto } from "@/features/auth/types";
import { ApiError } from "@/shared/api/error";
import { checkOrigin, fail, ok, readJson } from "@/shared/api/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await getSession();
  try {
    const { action } = await context.params;
    if (action !== "session")
      throw new ApiError(404, "ROUTE_NOT_FOUND", "API không tồn tại.");
    return ok(await withAuth(session, async (auth) => auth.user));
  } catch (error) {
    return fail(error, session);
  }
}

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  try {
    checkOrigin(request);
    const { action } = await context.params;
    switch (action) {
      case "login": {
        const auth = await backend<AuthResultDto>("auth/login", {
          method: "POST",
          body: await readJson(request),
        });
        await saveAuth(session, auth, true);
        return ok(auth.user);
      }
      case "refresh":
        return ok((await refreshSession(session)).user);
      case "logout": {
        if (readAuth(session))
          await withAuth(session, (auth) =>
            backend<null>("auth/logout", {
              method: "POST",
              token: auth.accessToken,
              body: { refreshToken: auth.refreshToken },
            }),
          );
        destroySession(session);
        return ok(null);
      }
      default:
        throw new ApiError(404, "ROUTE_NOT_FOUND", "API không tồn tại.");
    }
  } catch (error) {
    return fail(error, session);
  }
}
