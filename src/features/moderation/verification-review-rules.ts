import { ApiError, getErrorMessage } from "@/shared/api/error";
import { verificationDocumentTypes } from "@/features/owner/verification-rules";
import type { VerificationDto } from "@/features/owner/verification-types";
import type {
  ReviewVerificationRequestDto,
  VerificationDecision,
  VerificationQueueStatus,
} from "./verification-review-types";

/** MOD-V1 tabs, in the order a Mod works through them. */
export const queueTabs: { value: VerificationQueueStatus; label: string }[] = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "needs_more_info", label: "Chờ bổ sung" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
];

export const statusTone = (
  status: string,
): "success" | "warning" | "error" | "neutral" =>
  status === "approved"
    ? "success"
    : status === "rejected"
      ? "error"
      : status === "pending" || status === "needs_more_info"
        ? "warning"
        : "neutral";

export const decisionOptions: {
  value: VerificationDecision;
  label: string;
  hint: string;
  confirm: string;
}[] = [
  {
    value: "approve",
    label: "Duyệt hồ sơ",
    hint: "Nhà hàng được xác minh, hiển thị công khai và mở được bản thực đơn đầu tiên.",
    confirm: "Duyệt hồ sơ",
  },
  {
    value: "needs_more_info",
    label: "Yêu cầu bổ sung",
    hint: "Chủ quán nhận ghi chú của bạn và nộp lại hồ sơ đã sửa.",
    confirm: "Gửi yêu cầu bổ sung",
  },
  {
    value: "reject",
    label: "Từ chối",
    hint: "Hồ sơ không đạt; chủ quán nhận lý do bạn ghi.",
    confirm: "Từ chối hồ sơ",
  },
];

/** BE limit of `reviewNote` (ReviewVerificationRequestDtoValidator). */
export const reviewNoteMax = 1000;

/** The note is required to reject or ask for more information, and at most 1000 characters. */
export function decisionProblem(decision: VerificationDecision, note: string) {
  const text = note.trim();
  if (decision !== "approve" && !text)
    return decision === "reject"
      ? "Ghi lý do từ chối để chủ quán biết cần sửa gì."
      : "Ghi rõ thông tin hoặc giấy tờ chủ quán cần bổ sung.";
  if (text.length > reviewNoteMax)
    return `Ghi chú không được vượt quá ${reviewNoteMax} ký tự.`;
  return "";
}

/** MOD-V3 body: the trimmed note, left out when empty. */
export function decisionBody(
  decision: VerificationDecision,
  note: string,
): ReviewVerificationRequestDto {
  const text = note.trim();
  return text ? { decision, reviewNote: text } : { decision };
}

export const documentLabel = (docType: string) =>
  verificationDocumentTypes.find((item) => item.value === docType)?.label ??
  "Tài liệu khác";

/** A signed document URL that points to an image (by its path), to preview it inline. */
export function isImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const image = /^(png|jpe?g|webp|gif|avif)$/i;
    // A private document comes as a signed download link (`…/image/download?format=jpg&…`):
    // the path has no extension, the `format` parameter names the file type.
    return (
      image.test(parsed.pathname.split(".").pop() ?? "") ||
      image.test(parsed.searchParams.get("format") ?? "")
    );
  } catch {
    return false;
  }
}

/** "3 ngày" waiting since `submittedAt`; "Vừa gửi" under an hour. */
export function waitingFor(submittedAt: string, now = Date.now()) {
  const hours = Math.floor((now - Date.parse(submittedAt)) / 3_600_000);
  if (!Number.isFinite(hours) || hours < 1) return "Vừa gửi";
  if (hours < 24) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
}

/** What changed since the previous dossier, field by field, for a resubmission. */
export function dossierChanges(
  current: VerificationDto,
  previous: VerificationDto,
) {
  const docs = (item: VerificationDto) =>
    item.documents
      .map((document) => document.docType)
      .sort()
      .join(",");
  return [
    {
      label: "Tên pháp lý",
      before: previous.legalName,
      after: current.legalName,
    },
    {
      label: "Số giấy phép kinh doanh",
      before: previous.businessLicenseNo,
      after: current.businessLicenseNo,
    },
    {
      label: "Mã số thuế",
      before: previous.taxCode ?? "",
      after: current.taxCode ?? "",
    },
    {
      label: "Giấy tờ",
      before: `${previous.documents.length} tài liệu`,
      after: `${current.documents.length} tài liệu`,
      changed:
        docs(previous) !== docs(current) ||
        previous.documents.length !== current.documents.length,
    },
  ].map((row) => ({
    ...row,
    changed: row.changed ?? row.before.trim() !== row.after.trim(),
  }));
}

/** MOD-V1..MOD-V3 failures by `errorCode` (sheet "Mã lỗi"). */
export function verificationReviewError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "VERIFICATION_NOT_FOUND")
    return "Không tìm thấy hồ sơ xác minh này.";
  if (code === "VERIFICATION_ALREADY_REVIEWED")
    return "Hồ sơ này vừa được một Mod khác xử lý. Trang đã tải lại kết quả mới nhất.";
  if (code === "VALIDATION_FAILED")
    return "Thông tin chưa hợp lệ: ghi chú là bắt buộc khi từ chối hoặc yêu cầu bổ sung, tối đa 1000 ký tự.";
  if (code === "FORBIDDEN")
    return "Chỉ tài khoản Mod được duyệt hồ sơ xác minh nhà hàng.";
  return getErrorMessage(error);
}
