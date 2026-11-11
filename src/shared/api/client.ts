"use client";
import type {
  AuthUserDto,
  GoogleLoginClientDto,
  GoogleLoginRequestDto,
  LoginRequestDto,
  RegisterAccountRequestDto,
  RegisterAccountResponseDto,
} from "@/features/auth/types";
import { ApiError, readApiResponse } from "./error";
import { clearReadCache } from "./read-cache";

/**
 * A read refused with 429 is sent again once after the server's Retry-After when that wait is
 * short; a longer wait (or a write) is left to the caller, which shows "Vui lòng thử lại sau N giây".
 */
export const readRetryMaxSeconds = 10;

/** The Retry-After seconds of a 429 worth waiting for, else null. */
export function shortRetryAfter(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  // Without the header there is no known wait: left to the caller (Number(null) would be 0).
  if (!error.retryAfter?.trim()) return null;
  const seconds = Number(error.retryAfter);
  return Number.isFinite(seconds) &&
    seconds >= 0 &&
    seconds <= readRetryMaxSeconds
    ? seconds
    : null;
}

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  protectedCall = true,
): Promise<T> {
  const read = !init.method || init.method === "GET";
  try {
    return await send<T>(path, init, protectedCall);
  } catch (error) {
    const seconds = read ? shortRetryAfter(error) : null;
    if (seconds === null) throw error;
    await wait(seconds * 1000, init.signal);
    return send<T>(path, init, protectedCall);
  }
}

async function send<T>(
  path: string,
  init: RequestInit,
  protectedCall: boolean,
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("Thiếu NEXT_PUBLIC_API_BASE_URL.");
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
        headers,
      });
    } catch (error) {
      // A request cancelled by its caller (a newer search) stays a cancellation.
      if (init.signal?.aborted) throw error;
      throw new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Không kết nối được ứng dụng.",
      );
    }
    return await readApiResponse<T>(response);
  } catch (error) {
    if (
      protectedCall &&
      error instanceof ApiError &&
      [
        "UNAUTHORIZED",
        "REFRESH_TOKEN_INVALID",
        "ACCOUNT_BANNED",
        "ACCOUNT_DEACTIVATED",
        "ACCOUNT_SUSPENDED",
      ].includes(error.errorCode)
    ) {
      window.location.replace(
        `/login?reason=${encodeURIComponent(error.errorCode)}`,
      );
    }
    throw error;
  }
}
export const api = {
  register: (body: RegisterAccountRequestDto) =>
    request<RegisterAccountResponseDto>(
      "auth/register",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ),
  // AUTH-03, AUTH-08 and AUTH-09 answer 200 with `data: null`.
  resendVerification: (email: string) =>
    request<null>(
      "auth/verify-email/resend",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    ),
  forgotPassword: (email: string) =>
    request<null>(
      "auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    ),
  resetPassword: (token: string, newPassword: string) =>
    request<null>(
      "auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      },
      false,
    ),
  // Signing in or out changes how lists are ranked: cached reads are dropped.
  login: (body: LoginRequestDto) =>
    request<AuthUserDto>(
      "auth/login",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ).finally(clearReadCache),
  googleLogin: (body: GoogleLoginRequestDto) =>
    request<GoogleLoginClientDto>(
      "auth/google",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ).finally(clearReadCache),
  session: () => request<AuthUserDto>("auth/session"),
  refresh: () => request<AuthUserDto>("auth/refresh", { method: "POST" }),
  logout: () =>
    request<null>("auth/logout", { method: "POST" }).finally(clearReadCache),
  get: <T>(path: string) => request<T>(`backend/${path}`),
  /**
   * Gọi endpoint BE nhưng KHÔNG tự chuyển hướng khi BE trả 401.
   *
   * Dùng cho các lệnh "hỏi thăm" (probe) như `GET /me` trên trang công khai:
   * khách chưa đăng nhập vẫn xem được trang, chỉ là không có thông tin hồ sơ.
   * Nếu dùng `get` thì 401 sẽ kích hoạt `window.location.replace("/login")`
   * và server đồng thời xoá cookie phiên → người dùng đang đăng nhập bị
   * đẩy ra trang đăng nhập.
   */
  getOptional: <T>(path: string, signal?: AbortSignal) =>
    request<T>(`backend/${path}`, { signal }, false),
  /** Same-origin public route (province and ward catalog); never redirects to /login. */
  getPublic: <T>(path: string) => request<T>(path, {}, false),
  upload: <T>(path: string, body: FormData) =>
    request<T>(`backend/${path}`, { method: "POST", body }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(`backend/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(`backend/${path}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(`backend/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    request<T>(`backend/${path}`, { method: "DELETE" }),
};
