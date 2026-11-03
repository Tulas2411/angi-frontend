import { api } from "@/shared/api/client";
import type { VerificationDto } from "@/features/owner/verification-types";
import type {
  ListVerificationsQuery,
  ModVerificationsPageDto,
  ReviewVerificationRequestDto,
  VerificationReviewDetailDto,
} from "./verification-review-types";

/** F-57 through the same-origin proxy (Mod sessions only). */
export interface VerificationReviewService {
  /** MOD-V1: one page of the queue, oldest first. */
  list(query: ListVerificationsQuery): Promise<ModVerificationsPageDto>;
  /** MOD-V2: the dossier with its restaurant and the previous dossier. */
  detail(verificationId: number): Promise<VerificationReviewDetailDto>;
  /** MOD-V3: approves, rejects or asks for more information. */
  decide(
    verificationId: number,
    request: ReviewVerificationRequestDto,
  ): Promise<VerificationDto>;
}

export function verificationsQueryString(query: ListVerificationsQuery) {
  const params = new URLSearchParams();
  params.set("status", query.status);
  const province = query.province?.trim();
  if (province) params.set("province", province);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined)
    params.set("pageSize", String(query.pageSize));
  return `?${params.toString()}`;
}

export const verificationReviewService: VerificationReviewService = {
  list: (query) =>
    api.get<ModVerificationsPageDto>(
      `mod/verifications${verificationsQueryString(query)}`,
    ),
  detail: (verificationId) =>
    api.get<VerificationReviewDetailDto>(`mod/verifications/${verificationId}`),
  decide: (verificationId, request) =>
    api.post<VerificationDto>(
      `mod/verifications/${verificationId}/decision`,
      request,
    ),
};
