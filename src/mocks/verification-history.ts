import type { AppData } from "@/features/platform/contracts";
import type {
  GetVerificationStatusResponseDto,
  VerificationDto,
  VerificationStatus,
} from "@/features/owner/verification-types";

/** OWN-07 JSON sample, with no live/private document URL in demo state. */
export const verificationStatusSample: GetVerificationStatusResponseDto = {
  verificationStatus: "pending",
  items: [
    {
      id: 21,
      restaurantId: 7,
      status: "pending",
      legalName: "Hộ kinh doanh Bún Bò Bà Diệu",
      businessLicenseNo: "32A8012345",
      taxCode: "0401234567",
      ownerNote: "Bổ sung giấy ATTP",
      documents: [{ docType: "business_license", mediaId: 9001, url: "" }],
      previousId: null,
      submittedAt: "2026-10-01T03:00:00Z",
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
    },
  ],
};

/** Reviewed attempts stay in history when the next submission is created. */
export function verificationHistoryFixture(
  status: VerificationStatus = "pending",
): GetVerificationStatusResponseDto {
  const original = verificationStatusSample.items[0];
  const reviewer = { id: 5, displayName: "Hoài An", avatarUrl: null };
  const rejected: VerificationDto = {
    ...structuredClone(original),
    id: 21,
    status: "rejected",
    reviewedBy: reviewer,
    reviewedAt: "2026-10-02T04:00:00Z",
    reviewNote: "Giấy phép đã hết hiệu lực.",
  };
  const moreInfo: VerificationDto = {
    ...structuredClone(original),
    id: 22,
    status: "needs_more_info",
    previousId: 21,
    submittedAt: "2026-10-03T03:00:00Z",
    reviewedBy: reviewer,
    reviewedAt: "2026-10-04T04:00:00Z",
    reviewNote: "Bổ sung ảnh giấy phép rõ nét, đầy đủ các trang.",
  };
  const latest: VerificationDto = {
    ...structuredClone(original),
    id: 23,
    status,
    previousId: 22,
    submittedAt: "2026-10-05T03:00:00Z",
    reviewedBy:
      status === "pending" || status === "cancelled" ? null : reviewer,
    reviewedAt:
      status === "pending" || status === "cancelled"
        ? null
        : "2026-10-06T04:00:00Z",
    reviewNote:
      status === "approved"
        ? "Thông tin và tài liệu đã hợp lệ."
        : status === "rejected"
          ? "Giấy phép chưa hợp lệ."
          : status === "needs_more_info"
            ? "Cần bổ sung giấy chứng nhận an toàn thực phẩm."
            : null,
  };
  return {
    verificationStatus:
      status === "approved"
        ? "verified"
        : status === "pending"
          ? "pending"
          : status === "cancelled"
            ? "unverified"
            : "rejected",
    items: [latest, moreInfo, rejected],
  };
}

export function applyVerificationHistoryScenario(
  data: AppData,
  status: VerificationStatus = "pending",
) {
  const owner = data.restaurants.find(
    (item) => item.id === data.ownerRestaurantId,
  );
  if (!owner) return;
  const history = verificationHistoryFixture(status);
  owner.verification = history.verificationStatus;
  data.submissions = data.submissions.filter(
    (item) => item.kind !== "verification" || item.restaurantId !== owner.id,
  );
  data.submissions.unshift(
    ...history.items.map((item) => ({
      id: `verification-${item.id}`,
      kind: "verification" as const,
      restaurantId: owner.id,
      status:
        item.status === "needs_more_info"
          ? ("needs_changes" as const)
          : item.status,
      date: item.submittedAt,
      note: item.ownerNote ?? "",
      legalName: item.legalName,
      license: item.businessLicenseNo,
      taxCode: item.taxCode ?? "",
      previousId: item.previousId,
      reviewedBy: item.reviewedBy,
      reviewedAt: item.reviewedAt,
      reviewNote: item.reviewNote,
      documents: item.documents.map((document) => ({
        type: document.docType,
        mediaId: document.mediaId,
        url: "",
        name: "giay-phep.pdf",
      })),
    })),
  );
}
