import { ApiError } from "@/shared/api/error";
import type {
  OwnerRestaurantDto,
  MediaFileDto,
} from "@/features/owner/restaurant-types";
import type { VerificationService } from "@/features/owner/verification-service";
import type { VerificationDto } from "@/features/owner/verification-types";
import type { Submission } from "@/features/platform/contracts";
import {
  validateVerificationFile,
  validateVerificationRequest,
  verificationDocumentTypes,
} from "@/features/owner/verification-rules";

/** Translate legacy demo labels explicitly; the server DTO keeps numeric IDs. */
export function verificationFromDemo(
  record: Submission,
  restaurantId: number,
  fallbackId = 21,
): VerificationDto {
  return {
    id: Number(record.id.replace(/^verification-/, "")) || fallbackId,
    restaurantId,
    status:
      record.status === "needs_changes"
        ? "needs_more_info"
        : record.status === "draft"
          ? "cancelled"
          : record.status,
    legalName: record.legalName ?? "",
    businessLicenseNo: record.license ?? "",
    taxCode: record.taxCode || null,
    ownerNote: record.note || null,
    documents: (record.documents ?? []).map((document, index) => ({
      docType:
        verificationDocumentTypes.find(
          (item) =>
            item.value === document.type || item.label === document.type,
        )?.value ?? "other",
      mediaId: document.mediaId ?? 9001 + index,
      url: document.url ?? "",
    })),
    submittedAt: record.date,
    previousId: record.previousId ?? null,
    reviewedBy: record.reviewedBy ?? null,
    reviewedAt: record.reviewedAt ?? null,
    reviewNote: record.reviewNote ?? null,
  };
}

/** Local file metadata and wire-shaped responses; no upload or external storage. */
export function createMockVerificationService(
  seed: OwnerRestaurantDto | null,
  initialHistory?: VerificationDto[],
): VerificationService {
  let current = seed ? structuredClone(seed) : null;
  const history = structuredClone(
    initialHistory ??
      (seed?.latestVerification ? [seed.latestVerification] : []),
  ).filter((item) => item.restaurantId === seed?.id);
  let mediaId = 9000;
  const media = new Map<number, MediaFileDto>();
  return {
    getOwnerRestaurant: async () => {
      if (!current)
        throw new ApiError(
          404,
          "RESTAURANT_NOT_FOUND",
          "Bạn chưa đăng ký nhà hàng.",
        );
      return structuredClone(current);
    },
    getHistory: async () => {
      if (!current)
        throw new ApiError(
          404,
          "RESTAURANT_NOT_FOUND",
          "Bạn chưa đăng ký nhà hàng.",
        );
      return {
        verificationStatus: current.verificationStatus,
        items: structuredClone(history).sort(
          (a, b) =>
            Date.parse(b.submittedAt) - Date.parse(a.submittedAt) ||
            b.id - a.id,
        ),
      };
    },
    upload: async (file) => {
      if (!file.name.trim() || !file.type.trim() || file.size <= 0)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Tệp tải lên không hợp lệ.",
        );
      const error = validateVerificationFile(file);
      if (error)
        throw new ApiError(
          400,
          ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
            file.type,
          )
            ? "FILE_TOO_LARGE"
            : "UNSUPPORTED_MEDIA_TYPE",
          error,
        );
      const result: MediaFileDto = {
        id: ++mediaId,
        url: "",
        mimeType: file.type,
        sizeBytes: file.size,
        purpose: "verification_doc",
        createdAt: new Date().toISOString(),
      };
      media.set(result.id, result);
      return { ...result };
    },
    submit: async (request) => {
      const errors = validateVerificationRequest(request);
      if (Object.keys(errors).length)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Kiểm tra thông tin hồ sơ.",
          Object.fromEntries(
            Object.entries(errors).map(([key, value]) => [key, [value]]),
          ),
        );
      if (!current)
        throw new ApiError(
          404,
          "RESTAURANT_NOT_FOUND",
          "Bạn chưa đăng ký nhà hàng.",
        );
      if (current.verificationStatus !== "unverified") {
        const code =
          current.verificationStatus === "verified"
            ? "RESTAURANT_ALREADY_VERIFIED"
            : current.verificationStatus === "rejected"
              ? "VERIFICATION_RESUBMIT_REQUIRED"
              : "VERIFICATION_ALREADY_PENDING";
        throw new ApiError(
          409,
          code,
          "Trạng thái nhà hàng không cho phép nộp hồ sơ lần đầu.",
        );
      }
      const invalid = request.documents.findIndex(
        (document) => !media.has(document.mediaId),
      );
      if (invalid !== -1)
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "Tài liệu không thuộc phiên tải lên này.",
          { [`Documents[${invalid}].MediaId`]: ["Tải lại tài liệu xác minh."] },
        );
      const result: VerificationDto = {
        id: Math.max(20, ...history.map((item) => item.id)) + 1,
        restaurantId: current.id,
        status: "pending",
        legalName: request.legalName.trim(),
        businessLicenseNo: request.businessLicenseNo.trim(),
        taxCode: request.taxCode?.trim() || null,
        ownerNote: request.ownerNote?.trim() || null,
        documents: request.documents.map((document) => ({
          ...document,
          url: "",
        })),
        previousId: null,
        submittedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      };
      current = {
        ...current,
        verificationStatus: "pending",
        latestVerification: result,
      };
      history.unshift(result);
      return structuredClone(result);
    },
  };
}
