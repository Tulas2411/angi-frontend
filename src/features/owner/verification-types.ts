export type VerificationDocumentType =
  | "business_license"
  | "food_safety_cert"
  | "id_card"
  | "storefront_photo"
  | "other";
export type VerificationStatus =
  "pending" | "approved" | "rejected" | "needs_more_info" | "cancelled";

/** OWN-06 / API Design v1.8. File metadata never enters this request. */
export interface SubmitVerificationRequestDto {
  legalName: string;
  businessLicenseNo: string;
  taxCode?: string | null;
  ownerNote?: string | null;
  documents: { docType: VerificationDocumentType; mediaId: number }[];
}

/** OWN-08 replaces the complete dossier. Unlike OWN-06, no license document is required. */
export type ResubmitVerificationRequestDto = SubmitVerificationRequestDto;

export interface VerificationDto {
  id: number;
  restaurantId: number;
  status: VerificationStatus;
  legalName: string;
  businessLicenseNo: string;
  taxCode: string | null;
  ownerNote: string | null;
  documents: {
    docType: VerificationDocumentType;
    mediaId: number;
    url: string;
  }[];
  previousId: number | null;
  submittedAt: string;
  reviewedBy: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** OWN-07 returns the complete history, newest first; no pagination parameters. */
export interface GetVerificationStatusResponseDto {
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  items: VerificationDto[];
}

export interface VerificationFormValues {
  legalName: string;
  businessLicenseNo: string;
  taxCode: string;
  ownerNote: string;
}
