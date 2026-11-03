/**
 * Wire DTOs of F-57 Review Verification Submission (API Design v1.8: MOD-V1..MOD-V3; BE
 * `VerificationReviewDtos`, `ReviewVerificationRequestDto`).
 */
import type { RestaurantCardDto } from "@/features/explore/explore-types";
import type { OwnerRestaurantDto } from "@/features/owner/restaurant-types";
import type {
  VerificationDto,
  VerificationStatus,
} from "@/features/owner/verification-types";

/** MOD-V1 item: the dossier with the restaurant as a card. */
export interface ModVerificationCardDto extends VerificationDto {
  restaurant: RestaurantCardDto;
}

/** MOD-V2: the dossier, the restaurant as its owner sees it and the previous dossier if resubmitted. */
export interface VerificationReviewDetailDto extends VerificationDto {
  restaurant: OwnerRestaurantDto;
  previous: VerificationDto | null;
}

export interface ModVerificationsPageDto {
  items: ModVerificationCardDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** MOD-V1 query: the queue is oldest first; `status` defaults to pending. */
export type VerificationQueueStatus = Exclude<VerificationStatus, "cancelled">;
export interface ListVerificationsQuery {
  status: VerificationQueueStatus;
  province?: string;
  page?: number;
  pageSize?: number;
}

export type VerificationDecision = "approve" | "reject" | "needs_more_info";

/** MOD-V3 body: `reviewNote` ≤ 1000 characters, required for reject and needs_more_info. */
export interface ReviewVerificationRequestDto {
  decision: VerificationDecision;
  reviewNote?: string;
}
