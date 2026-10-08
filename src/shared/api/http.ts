import "server-only";
import { NextResponse } from "next/server";
import { destroySession, type AuthSession } from "@/features/auth/server";
import { ApiError } from "./error";

export function ok<T>(data: T) {
  return NextResponse.json(
    { success: true, message: null, errorCode: null, data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function fail(error: unknown, session?: AuthSession) {
  const e =
    error instanceof ApiError
      ? error
      : new ApiError(500, "INTERNAL_ERROR", "Có lỗi xảy ra trong ứng dụng.");
  if (
    session &&
    [
      "UNAUTHORIZED",
      "REFRESH_TOKEN_INVALID",
      "ACCOUNT_BANNED",
      "ACCOUNT_DEACTIVATED",
      "ACCOUNT_SUSPENDED",
    ].includes(e.errorCode)
  ) {
    destroySession(session);
  }
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (e.retryAfter) headers.set("Retry-After", e.retryAfter);
  return NextResponse.json(
    {
      success: false,
      message: e.message,
      errorCode: e.errorCode,
      data: e.data,
      ...(e.errors ? { errors: e.errors } : {}),
    },
    { status: e.status, headers },
  );
}
export function checkOrigin(request: Request) {
  const appUrl = process.env.APP_URL;
  if (!appUrl || request.headers.get("origin") !== new URL(appUrl).origin) {
    throw new ApiError(403, "FORBIDDEN", "Nguồn gửi yêu cầu không hợp lệ.");
  }
}
export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Body phải là JSON hợp lệ.");
  }
}
