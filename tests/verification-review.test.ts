import { describe, expect, it } from "vitest";
import {
  decisionBody,
  decisionProblem,
  documentLabel,
  dossierChanges,
  isImageUrl,
  statusTone,
  verificationReviewError,
  waitingFor,
} from "@/features/moderation/verification-review-rules";
import { verificationsQueryString } from "@/features/moderation/verification-review-service";
import type { VerificationDto } from "@/features/owner/verification-types";
import { moderationVerificationsOperation } from "@/shared/api/moderation-proxy";
import { ApiError } from "@/shared/api/error";

const dossier = (over: Partial<VerificationDto> = {}): VerificationDto => ({
  id: 41,
  restaurantId: 7,
  status: "pending",
  legalName: "Hộ kinh doanh Bún Bò Bà Diệu",
  businessLicenseNo: "0401234567",
  taxCode: null,
  ownerNote: null,
  documents: [
    {
      docType: "business_license",
      mediaId: 1,
      url: "https://cdn.example/a.jpg",
    },
  ],
  previousId: null,
  submittedAt: "2026-10-01T02:00:00Z",
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  ...over,
});

describe("F-57 decision (ReviewVerificationRequestDtoValidator)", () => {
  it("needs a note to reject or ask for more, never to approve", () => {
    expect(decisionProblem("approve", "")).toBe("");
    expect(decisionProblem("reject", "   ")).toBe(
      "Ghi lý do từ chối để chủ quán biết cần sửa gì.",
    );
    expect(decisionProblem("needs_more_info", "")).toBe(
      "Ghi rõ thông tin hoặc giấy tờ chủ quán cần bổ sung.",
    );
    expect(decisionProblem("reject", "x".repeat(1001))).toBe(
      "Ghi chú không được vượt quá 1000 ký tự.",
    );
    expect(decisionProblem("reject", "x".repeat(1000))).toBe("");
  });

  it("sends the trimmed note, or none", () => {
    expect(decisionBody("approve", "  ")).toEqual({ decision: "approve" });
    expect(decisionBody("reject", "  Sai tên  ")).toEqual({
      decision: "reject",
      reviewNote: "Sai tên",
    });
  });
});

describe("F-57 dossier display", () => {
  it("labels documents and previews only images", () => {
    expect(documentLabel("business_license")).toBe("Giấy phép kinh doanh");
    expect(documentLabel("unknown_kind")).toBe("Tài liệu khác");
    expect(isImageUrl("https://cdn.example/doc.JPG?sig=1")).toBe(true);
    expect(isImageUrl("https://cdn.example/doc.pdf?sig=1")).toBe(false);
    expect(isImageUrl("not a url")).toBe(false);
    // Private documents: a signed Cloudinary download link, the type only in `format`.
    expect(
      isImageUrl(
        "https://api.cloudinary.com/v1_1/demo/image/download?format=jpg&public_id=verification_doc/a&signature=x",
      ),
    ).toBe(true);
    expect(
      isImageUrl(
        "https://api.cloudinary.com/v1_1/demo/image/download?format=pdf&public_id=verification_doc/a",
      ),
    ).toBe(false);
  });

  it("shows how long a dossier waited", () => {
    const sent = "2026-10-01T02:00:00Z";
    const at = (hours: number) => Date.parse(sent) + hours * 3_600_000;
    expect(waitingFor(sent, at(0.5))).toBe("Vừa gửi");
    expect(waitingFor(sent, at(5))).toBe("5 giờ");
    expect(waitingFor(sent, at(50))).toBe("2 ngày");
  });

  it("marks what changed since the previous dossier", () => {
    const previous = dossier({ id: 40, status: "needs_more_info" });
    const current = dossier({
      previousId: 40,
      businessLicenseNo: "0409999999",
      documents: [
        ...previous.documents,
        {
          docType: "storefront_photo",
          mediaId: 2,
          url: "https://cdn.example/b.jpg",
        },
      ],
    });
    const rows = dossierChanges(current, previous);
    expect(rows.filter((row) => row.changed).map((row) => row.label)).toEqual([
      "Số giấy phép kinh doanh",
      "Giấy tờ",
    ]);
  });

  it("colours the statuses and words the error codes", () => {
    expect(statusTone("approved")).toBe("success");
    expect(statusTone("rejected")).toBe("error");
    expect(statusTone("needs_more_info")).toBe("warning");
    expect(
      verificationReviewError(
        new ApiError(409, "VERIFICATION_ALREADY_REVIEWED", "x"),
      ),
    ).toContain("vừa được một Mod khác xử lý");
    expect(
      verificationReviewError(new ApiError(404, "VERIFICATION_NOT_FOUND", "x")),
    ).toBe("Không tìm thấy hồ sơ xác minh này.");
  });
});

describe("F-57 requests and proxy", () => {
  it("always sends the status, the province only when given", () => {
    expect(
      verificationsQueryString({ status: "pending", page: 1, pageSize: 20 }),
    ).toBe("?status=pending&page=1&pageSize=20");
    expect(
      verificationsQueryString({
        status: "approved",
        province: " Thành phố Đà Nẵng ",
      }),
    ).toBe(
      "?status=approved&province=Th%C3%A0nh+ph%E1%BB%91+%C4%90%C3%A0+N%E1%BA%B5ng",
    );
  });

  it("lets exactly MOD-V1, MOD-V2 and MOD-V3 through", () => {
    expect(
      moderationVerificationsOperation("GET", "mod/verifications"),
    ).toEqual({
      body: false,
      status: 200,
    });
    expect(
      moderationVerificationsOperation("GET", "mod/verifications/41")?.body,
    ).toBe(false);
    expect(
      moderationVerificationsOperation("POST", "mod/verifications/41/decision"),
    ).toEqual({ body: true, status: 200 });
    for (const [method, path] of [
      ["POST", "mod/verifications"],
      ["GET", "mod/verifications/0"],
      ["GET", "mod/verifications/41/decision"],
      ["PUT", "mod/verifications/41/decision"],
      ["DELETE", "mod/verifications/41"],
    ])
      expect(
        moderationVerificationsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});
