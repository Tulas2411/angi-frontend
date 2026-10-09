import type { ApiResponse } from "@/shared/types/api";

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly errors?: Record<string, string[]>;
  readonly data: unknown;
  readonly retryAfter: string | null;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    errors?: Record<string, string[]>,
    data: unknown = null,
    retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
    this.data = data;
    this.retryAfter = retryAfter;
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      response.ok ? 502 : response.status,
      response.ok ? "INVALID_RESPONSE" : `HTTP_${response.status}`,
      "Hệ thống trả về phản hồi không hợp lệ.",
    );
  }
  if (!payload || typeof payload.success !== "boolean") {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "Response không đúng cấu trúc ApiResponse.",
    );
  }
  if (!response.ok || !payload.success) {
    throw new ApiError(
      response.status,
      payload.errorCode ?? `HTTP_${response.status}`,
      payload.message ?? "Yêu cầu thất bại.",
      payload.errors,
      payload.data,
      response.headers.get("Retry-After"),
    );
  }
  if (!("data" in payload)) {
    throw new ApiError(502, "INVALID_RESPONSE", "Response thiếu trường data.");
  }
  return payload.data as T;
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Có lỗi xảy ra. Vui lòng thử lại.";
  if (error.errorCode === "ACCOUNT_SUSPENDED") {
    const detail = error.data as { suspendedUntil?: string | null } | null;
    return detail?.suspendedUntil
      ? `Tài khoản bị tạm khóa đến ${new Date(detail.suspendedUntil).toLocaleString("vi-VN")}.`
      : "Tài khoản đang bị tạm khóa.";
  }
  if (error.errorCode === "TOO_MANY_REQUESTS") {
    return error.retryAfter
      ? `Vui lòng thử lại sau ${error.retryAfter} giây.`
      : "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.";
  }
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
    EMAIL_NOT_VERIFIED: "Bạn cần xác minh email trước khi đăng nhập.",
    ACCOUNT_BANNED: "Tài khoản đã bị cấm.",
    ACCOUNT_DEACTIVATED: "Tài khoản đã ngừng hoạt động.",
    VALIDATION_FAILED: "Vui lòng kiểm tra thông tin đã nhập.",
    UNAUTHORIZED: "Phiên đăng nhập không còn hợp lệ.",
    REFRESH_TOKEN_INVALID: "Phiên đăng nhập đã hết hiệu lực.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    NOT_OWNER: "Bạn không có quyền quản lý nội dung này.",
    TOKEN_EXPIRED: "Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới.",
    INTERNAL_ERROR: "Hệ thống gặp lỗi. Vui lòng thử lại sau.",
    SERVICE_UNAVAILABLE: "Hiện chưa kết nối được với hệ thống.",
  };
  return messages[error.errorCode] ?? error.message;
}
