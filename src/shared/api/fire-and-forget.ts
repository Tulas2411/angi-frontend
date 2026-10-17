/**
 * Fire-and-forget helpers: gọi API BE song song với luồng mock.
 *
 * Mục đích: trong giai đoạn chuyển tiếp (chưa có database thật), UI vẫn hiển thị
 * data từ mock, đồng thời gửi request đến BE thật để:
 *   - xác nhận hợp đồng API vẫn đúng,
 *   - có sẵn log khi BE từ chối / có lỗi schema,
 *   - sau này chỉ cần đổi `mode="live"` là chuyển sang dùng response thật.
 *
 * Mọi lỗi đều bị nuốt và chỉ in ra console — KHÔNG bao giờ throw lên UI.
 */

import type { ApiError } from "./error";

/** Gọi async, nuốt mọi lỗi, log với tag để dễ filter trong DevTools. */
export function fireAndForget<T>(
  label: string,
  task: () => Promise<T>,
  onSuccess?: (value: T) => void,
): void {
  task()
    .then((value) => {
      if (onSuccess) onSuccess(value);
    })
    .catch((error: unknown) => {
      if (isExpectedOfflineError(error)) return;
      // eslint-disable-next-line no-console
      console.warn(`[be:${label}]`, describeError(error));
    });
}

/** Trả về Promise nhưng luôn resolve (không bao giờ reject) — dùng khi cần await mà không cần xử lý lỗi. */
export async function fireAndCollect<T>(
  label: string,
  task: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await task();
  } catch (error) {
    if (!isExpectedOfflineError(error)) {
      // eslint-disable-next-line no-console
      console.warn(`[be:${label}]`, describeError(error));
    }
    return undefined;
  }
}

function isExpectedOfflineError(error: unknown): boolean {
  // Backend có thể chưa chạy hoặc chưa có database — đây là điều kiện bình thường
  // trong giai đoạn chuyển tiếp, không nên spam console.
  if (!error || typeof error !== "object") return false;
  const err = error as Partial<ApiError> & { message?: string };
  if (err.errorCode === "SERVICE_UNAVAILABLE") return true;
  if (typeof err.message === "string") {
    if (err.message.includes("Failed to fetch")) return true;
    if (err.message.includes("NetworkError")) return true;
    if (err.message.includes("Không kết nối được")) return true;
  }
  return false;
}

function describeError(error: unknown): string {
  if (!error) return "unknown";
  if (typeof error === "object" && "errorCode" in error) {
    const e = error as ApiError;
    return `${e.errorCode} (${e.status}): ${e.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
