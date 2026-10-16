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

export interface VerificationFormValues {
  legalName: string;
  businessLicenseNo: string;
  taxCode: string;
  ownerNote: string;
}
