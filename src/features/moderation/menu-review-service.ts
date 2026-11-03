import { api } from "@/shared/api/client";
import type { MenuSubmissionDto } from "@/features/owner/menu-types";
import type {
  ApproveMenuSubmissionResponseDto,
  ListMenuSubmissionsQuery,
  ModMenuSubmissionDetailDto,
  ModMenuSubmissionsPageDto,
} from "./menu-review-types";

/** F-58 through the same-origin proxy (Mod and Admin sessions). */
export interface MenuReviewService {
  /** MOD-M1: one page of the queue. */
  list(query: ListMenuSubmissionsQuery): Promise<ModMenuSubmissionsPageDto>;
  /** MOD-M2: the submission compared with the running menu. */
  detail(submissionId: number): Promise<ModMenuSubmissionDetailDto>;
  /** MOD-M3: the new menu replaces the running one; `reviewNote` is optional. */
  approve(
    submissionId: number,
    reviewNote?: string,
  ): Promise<ApproveMenuSubmissionResponseDto>;
  /** MOD-M4: the running menu stays; `reviewNote` (the reason) is required. */
  reject(submissionId: number, reviewNote: string): Promise<MenuSubmissionDto>;
}

export function menuSubmissionsQueryString(query: ListMenuSubmissionsQuery) {
  const params = new URLSearchParams();
  params.set("status", query.status);
  if (query.restaurantId)
    params.set("restaurantId", String(query.restaurantId));
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined)
    params.set("pageSize", String(query.pageSize));
  return `?${params.toString()}`;
}

const base = "mod/menu-submissions";

export const menuReviewService: MenuReviewService = {
  list: (query) =>
    api.get<ModMenuSubmissionsPageDto>(
      `${base}${menuSubmissionsQueryString(query)}`,
    ),
  detail: (submissionId) =>
    api.get<ModMenuSubmissionDetailDto>(`${base}/${submissionId}`),
  approve: (submissionId, reviewNote) =>
    api.post<ApproveMenuSubmissionResponseDto>(
      `${base}/${submissionId}/approve`,
      reviewNote ? { reviewNote } : {},
    ),
  reject: (submissionId, reviewNote) =>
    api.post<MenuSubmissionDto>(`${base}/${submissionId}/reject`, {
      reviewNote,
    }),
};
