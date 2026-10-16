import { Badge } from "@/shared/ui";
import {
  verificationDocumentTypes,
  verificationStatusLabels,
} from "./verification-rules";
import type { VerificationDto } from "./verification-types";

export function verificationDateLabel(value: string | null): string {
  return !value || Number.isNaN(Date.parse(value))
    ? "Chưa có"
    : new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Keep signed query parameters intact; never turn arbitrary schemes into links. */
export function verificationDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function VerificationDetails({
  verification,
}: {
  verification: VerificationDto;
}) {
  return (
    <div className="stack-sm verification-details">
      <p>
        Mã hồ sơ: #{verification.id} ·{" "}
        <Badge>{verificationStatusLabels[verification.status]}</Badge>
      </p>
      <dl>
        <dt>Tên pháp lý</dt>
        <dd>{verification.legalName}</dd>
        <dt>Số giấy phép kinh doanh</dt>
        <dd>{verification.businessLicenseNo}</dd>
        <dt>Mã số thuế</dt>
        <dd>{verification.taxCode || "Chưa cung cấp"}</dd>
        <dt>Ngày gửi</dt>
        <dd>{verificationDateLabel(verification.submittedAt)}</dd>
        <dt>Ghi chú của bạn</dt>
        <dd>{verification.ownerNote || "Không có"}</dd>
        <dt>Người duyệt</dt>
        <dd>{verification.reviewedBy?.displayName || "Chưa có"}</dd>
        <dt>Ngày phản hồi</dt>
        <dd>{verificationDateLabel(verification.reviewedAt)}</dd>
        <dt>Phản hồi của người duyệt</dt>
        <dd>{verification.reviewNote || "Chưa có phản hồi."}</dd>
        {verification.previousId !== null && (
          <>
            <dt>Hồ sơ trước</dt>
            <dd>#{verification.previousId}</dd>
          </>
        )}
      </dl>
      <ul className="verification-document-links">
        {verification.documents.map((document, index) => {
          const label =
            verificationDocumentTypes.find(
              (type) => type.value === document.docType,
            )?.label ?? "Tài liệu xác minh";
          const url = verificationDocumentUrl(document.url);
          return (
            <li key={`${document.mediaId}-${index}`}>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {label} {index + 1}
                </a>
              ) : (
                <span>
                  {label} {index + 1} · Chưa có liên kết tài liệu
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="helper">
        Liên kết tài liệu chỉ được mở khi bạn bấm. Nếu hết hạn, tải lại trạng
        thái hoặc lịch sử để lấy liên kết mới.
      </p>
    </div>
  );
}
