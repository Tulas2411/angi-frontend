import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleBottomCenterTextIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/shared/ui";
import {
  verificationDocumentTypes,
  verificationStatusLabels,
} from "./verification-rules";
import type { VerificationDto, VerificationStatus } from "./verification-types";

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

export const verificationStatusTone: Record<
  VerificationStatus,
  "neutral" | "success" | "warning" | "error"
> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  needs_more_info: "warning",
  cancelled: "neutral",
};

/**
 * One dossier: the legal facts as tiles, the reviewer's answer as its own block (the part the
 * owner reads first), then the documents as chips that open in a new tab.
 */
export function VerificationDetails({
  verification,
}: {
  verification: VerificationDto;
}) {
  const reviewed = !!verification.reviewedAt || !!verification.reviewNote;
  return (
    <div className="verification-details">
      <div className="vf-details-head">
        <strong>Hồ sơ #{verification.id}</strong>
        <Badge tone={verificationStatusTone[verification.status]}>
          {verificationStatusLabels[verification.status]}
        </Badge>
        {verification.previousId !== null && (
          <span className="helper">
            Gửi lại từ hồ sơ #{verification.previousId}
          </span>
        )}
      </div>
      <dl className="vf-facts">
        <div>
          <dt>Tên pháp lý</dt>
          <dd>{verification.legalName}</dd>
        </div>
        <div>
          <dt>Số giấy phép kinh doanh</dt>
          <dd>{verification.businessLicenseNo}</dd>
        </div>
        <div>
          <dt>Mã số thuế</dt>
          <dd>{verification.taxCode || "Chưa cung cấp"}</dd>
        </div>
        <div>
          <dt>Ngày gửi</dt>
          <dd>{verificationDateLabel(verification.submittedAt)}</dd>
        </div>
      </dl>
      {verification.ownerNote && (
        <div className="vf-owner-note">
          <span>Ghi chú của bạn</span>
          <p>{verification.ownerNote}</p>
        </div>
      )}
      <section
        className="vf-review"
        data-tone={reviewed ? verificationStatusTone[verification.status] : "neutral"}
      >
        <header>
          <ChatBubbleBottomCenterTextIcon aria-hidden />
          <h4>Phản hồi của người duyệt</h4>
        </header>
        <p>{verification.reviewNote || "Chưa có phản hồi."}</p>
        {reviewed && (
          <p className="vf-review-meta">
            <strong>{verification.reviewedBy?.displayName || "Người duyệt"}</strong>
            <span>{verificationDateLabel(verification.reviewedAt)}</span>
          </p>
        )}
      </section>
      <div className="vf-docs-block">
        <h4>Tài liệu đã gửi · {verification.documents.length}</h4>
        <ul className="vf-docs">
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
                    <DocumentTextIcon aria-hidden />
                    <span>
                      {label} {index + 1}
                    </span>
                    <ArrowTopRightOnSquareIcon aria-hidden />
                  </a>
                ) : (
                  <span>
                    <DocumentTextIcon aria-hidden />
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
    </div>
  );
}
