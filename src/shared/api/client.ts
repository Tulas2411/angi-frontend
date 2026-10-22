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

async function request<T>(
  path: string,
  init: RequestInit = {},
  protectedCall = true,
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
    } catch {
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
  resendVerification: (email: string) =>
    request<{ sent: boolean }>(
      "auth/verify-email/resend",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    ),
  forgotPassword: (email: string) =>
    request<{ sent: boolean }>(
      "auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    ),
  resetPassword: (token: string, newPassword: string) =>
    request<{ userId: string; status: string }>(
      "auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      },
      false,
    ),
  login: (body: LoginRequestDto) =>
    request<AuthUserDto>(
      "auth/login",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ),
  googleLogin: (body: GoogleLoginRequestDto) =>
    request<GoogleLoginClientDto>(
      "auth/google",
      { method: "POST", body: JSON.stringify(body) },
      false,
    ),
  session: () => request<AuthUserDto>("auth/session"),
  refresh: () => request<AuthUserDto>("auth/refresh", { method: "POST" }),
  logout: () => request<null>("auth/logout", { method: "POST" }),
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
  getOptional: <T>(path: string) => request<T>(`backend/${path}`, {}, false),
  getPublic: <T>(path: string) => request<T>(path, {}, false),
  upload: <T>(path: string, body: FormData) =>
    request<T>(`backend/${path}`, { method: "POST", body }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(`backend/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
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
