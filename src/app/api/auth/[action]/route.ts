import {
  backend,
  destroySession,
  getSession,
  readAuth,
  refreshSession,
  saveAuth,
  withAuth,
} from "@/features/auth/server";
import type {
  AuthResultDto,
  RegisterAccountRequestDto,
  RegisterAccountResponseDto,
} from "@/features/auth/types";
import { ApiError } from "@/shared/api/error";
import { checkOrigin, fail, ok, readJson } from "@/shared/api/http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };

// AUTH-01 returns 201 Created. Preserve the designed status when forwarding to the browser.
function created<T>(data: T) {
  return NextResponse.json(
    { success: true, message: null, errorCode: null, data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

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
      case "register": {
        // Public endpoint. No session is read or written here because registration
        // creates a pending_verification account and never returns tokens.
        const body = (await readJson(request)) as RegisterAccountRequestDto;
        const result = await backend<RegisterAccountResponseDto>(
          "auth/register",
          { method: "POST", body },
        );
        return created(result);
      }
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
