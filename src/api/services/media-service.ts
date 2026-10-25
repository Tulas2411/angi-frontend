import { api } from "@/shared/api/client";
import type { MediaFileDto } from "@/shared/types/angi-dto";

/**
 * MEDIA-01 — các mục đích tải lên mà backend chấp nhận.
 * BE kiểm tra theo đúng danh sách này, gửi sai sẽ bị 400.
 */
export type MediaPurpose =
  | "avatar"
  | "restaurant"
  | "dish"
  | "blog"
  | "review"
  | "verification_doc"
  | "report_evidence";

export interface MediaService {
  /** 201 Created với metadata của tệp vừa tải lên. */
  upload(file: File, purpose: MediaPurpose): Promise<MediaFileDto>;
}

export const mediaService: MediaService = {
  upload: (file, purpose) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", purpose);
    return api.upload<MediaFileDto>("media", body);
  },
};

/**
 * Tải nhiều tệp lên và trả về danh sách media id.
 *
 * Tệp bị lỗi không làm hỏng cả lô: id của tệp đó bị bỏ qua, những tệp còn
 * lại vẫn được dùng. Hàm trả về `null` khi không tệp nào tải lên được.
 */
export async function uploadMediaIds(
  files: File[],
  purpose: MediaPurpose,
): Promise<number[] | null> {
  if (!files.length) return null;
  const results = await Promise.allSettled(
    files.map((file) => mediaService.upload(file, purpose)),
  );
  const ids = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value.id] : [],
  );
  return ids.length ? ids : null;
}
