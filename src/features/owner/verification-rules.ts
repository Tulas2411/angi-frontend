import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  OwnerRestaurantDto,
  VerificationDocumentSelection,
} from "./restaurant-types";
import type {
  SubmitVerificationRequestDto,
  VerificationDocumentType,
  VerificationFormValues,
  VerificationDto,
} from "./verification-types";

export const verificationDocumentTypes: {
  value: VerificationDocumentType;
  label: string;
}[] = [
  { value: "business_license", label: "Giấy phép kinh doanh" },
  { value: "food_safety_cert", label: "Giấy chứng nhận an toàn thực phẩm" },
  { value: "id_card", label: "Giấy tờ tùy thân" },
  { value: "storefront_photo", label: "Ảnh mặt tiền nhà hàng" },
  { value: "other", label: "Tài liệu khác" },
];
export const verificationStatusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã được duyệt",
  rejected: "Bị từ chối",
  needs_more_info: "Cần bổ sung thông tin",
  cancelled: "Đã hủy",
};
export const emptyVerificationForm: VerificationFormValues = {
  legalName: "",
  businessLicenseNo: "",
  taxCode: "",
  ownerNote: "",
};

export function verificationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      VERIFICATION_ALREADY_PENDING:
        "Nhà hàng đã có hồ sơ đang chờ duyệt. Tải lại trạng thái để xem hồ sơ hiện tại.",
      RESTAURANT_ALREADY_VERIFIED:
        "Nhà hàng đã được xác minh. Không cần gửi thêm hồ sơ.",
      VERIFICATION_RESUBMIT_REQUIRED:
        "Hồ sơ trước cần được gửi lại qua luồng bổ sung, không thể nộp như hồ sơ lần đầu.",
      VERIFICATION_NOT_RESUBMITTABLE:
        "Hồ sơ này không còn được phép gửi lại. Tải lại trạng thái để xem hồ sơ mới nhất.",
      VERIFICATION_NOT_FOUND:
        "Không tìm thấy hồ sơ xác minh của bạn. Tải lại trạng thái trước khi tiếp tục.",
      RESTAURANT_NOT_FOUND:
        "Không tìm thấy nhà hàng của bạn. Tải lại trạng thái trước khi tiếp tục.",
      FILE_TOO_LARGE: "Tệp quá lớn. Ảnh tối đa 5 MB, PDF tối đa 10 MB.",
      UNSUPPORTED_MEDIA_TYPE: "Chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.",
    };
    if (messages[error.errorCode]) return messages[error.errorCode];
  }
  return getErrorMessage(error);
}

export function verificationSubmissionBlock(
  restaurant: Pick<OwnerRestaurantDto, "verificationStatus">,
): string {
  if (restaurant.verificationStatus === "verified")
    return "Nhà hàng đã được xác minh.";
  if (restaurant.verificationStatus === "pending")
    return "Nhà hàng đã có hồ sơ đang chờ duyệt. Bạn không thể gửi thêm hồ sơ lần đầu.";
  if (restaurant.verificationStatus === "rejected")
    return "Hồ sơ trước đã bị từ chối hoặc yêu cầu bổ sung. Chọn Gửi lại hồ sơ tại thẻ Trạng thái xác minh để chỉnh sửa.";
  return "";
}

/** Only the latest attempt can be resubmitted; mirror OWN-08's restaurant guard. */
export function resubmittableVerification(
  restaurant: Pick<
    OwnerRestaurantDto,
    "verificationStatus" | "latestVerification"
  >,
): VerificationDto | null {
  const latest = restaurant.latestVerification;
  return restaurant.verificationStatus !== "pending" &&
    restaurant.verificationStatus !== "verified" &&
    latest &&
    Number.isSafeInteger(latest.id) &&
    latest.id > 0 &&
    (latest.status === "rejected" || latest.status === "needs_more_info")
    ? latest
    : null;
}

export function verificationResubmissionDraft(previous: VerificationDto): {
  values: VerificationFormValues;
  documents: VerificationDocumentSelection[];
} {
  return {
    values: {
      legalName: previous.legalName,
      businessLicenseNo: previous.businessLicenseNo,
      taxCode: previous.taxCode ?? "",
      ownerNote: previous.ownerNote ?? "",
    },
    documents: previous.documents.map((document, index) => ({
      key: `retained-${previous.id}-${index}`,
      fileName: `Tài liệu đã gửi #${document.mediaId}`,
      docType: document.docType,
      media: { id: document.mediaId, url: document.url },
      retained: true,
    })),
  };
}

export function validateVerificationFile(
  file: Pick<File, "size" | "type">,
): string {
  const pdf = file.type === "application/pdf";
  if (!pdf && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.";
  if (!Number.isFinite(file.size) || file.size <= 0)
    return "Tệp không được rỗng.";
  if (file.size > (pdf ? 10 : 5) * 1024 * 1024)
    return pdf
      ? "PDF không được vượt quá 10 MB."
      : "Ảnh không được vượt quá 5 MB.";
  return "";
}

export function buildVerificationRequest(
  values: VerificationFormValues,
  documents: VerificationDocumentSelection[],
): SubmitVerificationRequestDto {
  return {
    legalName: values.legalName.trim(),
    businessLicenseNo: values.businessLicenseNo.trim(),
    taxCode: values.taxCode.trim() || undefined,
    ownerNote: values.ownerNote.trim() || undefined,
    documents: documents.map((document) => ({
      docType: document.docType,
      mediaId: document.media.id,
    })),
  };
}

export function validateVerificationRequest(
  request: SubmitVerificationRequestDto,
  mode: "initial" | "resubmit" = "initial",
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, limit, label, required] of [
    ["legalName", 255, "Tên pháp lý", true],
    ["businessLicenseNo", 50, "Số giấy phép kinh doanh", true],
    ["taxCode", 20, "Mã số thuế", false],
    ["ownerNote", 1000, "Ghi chú", false],
  ] as const) {
    const value = request[key]?.trim() ?? "";
    if (required && !value) errors[key] = `${label} là bắt buộc.`;
    else if (value.length > limit)
      errors[key] = `${label} không được vượt quá ${limit} ký tự.`;
  }
  if (!request.documents.length)
    errors.documents =
      mode === "resubmit"
        ? "Chọn ít nhất một tài liệu cho lần gửi lại."
        : "Tải lên ít nhất một giấy phép kinh doanh.";
  else if (
    mode === "initial" &&
    !request.documents.some((item) => item.docType === "business_license")
  )
    errors.documents =
      "Phải có ít nhất một tài liệu loại Giấy phép kinh doanh.";
  request.documents.forEach((document, index) => {
    if (
      !verificationDocumentTypes.some((type) => type.value === document.docType)
    )
      errors[`documents[${index}].docType`] = "Loại tài liệu không hợp lệ.";
    if (!Number.isSafeInteger(document.mediaId) || document.mediaId <= 0)
      errors[`documents[${index}].mediaId`] =
        "Tải lên tài liệu thành công trước khi gửi hồ sơ.";
  });
  return errors;
}

export function verificationFieldErrors(
  errors?: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([key, values]) => [
      key
        .replace(/^\$\./, "")
        .replace(
          /(^|\.)([A-Z])/g,
          (_, prefix: string, character: string) =>
            `${prefix}${character.toLowerCase()}`,
        ),
      values.join(" "),
    ]),
  );
}
