import type {
  SubmitVerificationRequestDto,
  VerificationDto,
} from "../../src/features/owner/verification-types";

/** OWN-06, API Design v1.8 / JSON mẫu rows 2016–2053. */
export const verificationRequestSample: SubmitVerificationRequestDto = {
  legalName: "Hộ kinh doanh Bún Bò Bà Diệu",
  businessLicenseNo: "32A8012345",
  taxCode: "0401234567",
  ownerNote: "Bổ sung giấy ATTP",
  documents: [{ docType: "business_license", mediaId: 9001 }],
};
export const verificationSample: VerificationDto = {
  id: 21,
  restaurantId: 7,
  status: "pending",
  ...verificationRequestSample,
  taxCode: "0401234567",
  ownerNote: "Bổ sung giấy ATTP",
  documents: [
    {
      docType: "business_license",
      mediaId: 9001,
      url: "https://example.invalid/private-license.pdf",
    },
  ],
  previousId: null,
  submittedAt: "2026-10-01T03:00:00Z",
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
};
