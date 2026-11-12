import { api } from "@/shared/api/client";
import type {
  MenuItemDto,
  MenuSubmissionDto,
} from "@/features/owner/menu-types";
import {
  compareItems,
  itemCounts,
  previousApproved,
} from "./menu-review-rules";
import type {
  ApproveMenuSubmissionResponseDto,
  ListMenuSubmissionsQuery,
  ModMenuSubmissionCardDto,
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

/** MOD-M1 accepts at most 100 per page (ListModMenuSubmissionsRequestDtoValidator). */
const baselinePageSize = 100;
/** A restaurant with more approved menus than this is compared with what MOD-M2 sends. */
const baselineMaxPages = 5;

/** MOD-M1: every approved submission of one restaurant (at most `baselineMaxPages` pages). */
async function listApproved(service: MenuReviewService, restaurantId: number) {
  const cards: ModMenuSubmissionCardDto[] = [];
  for (let page = 1; page <= baselineMaxPages; page += 1) {
    const result = await service.list({
      status: "approved",
      restaurantId,
      page,
      pageSize: baselinePageSize,
    });
    cards.push(...result.items);
    if (page >= result.totalPages) break;
  }
  return cards;
}

/**
 * The items of the approved submission reviewed last before `submission` (MOD-M1 filtered by
 * restaurant, then MOD-M2): the menu that `submission` replaced. `null` when there is none.
 */
export async function loadApprovedBaseline(
  service: MenuReviewService,
  submission: Pick<MenuSubmissionDto, "id" | "restaurantId" | "reviewedAt">,
): Promise<{
  submissionId: number;
  reviewedAt: string | null;
  items: MenuItemDto[];
} | null> {
  const cards = await listApproved(service, submission.restaurantId);
  const previous = previousApproved(cards, submission);
  if (!previous) return null;
  const detail = await service.detail(previous.id);
  return {
    submissionId: detail.id,
    reviewedAt: detail.reviewedAt,
    items: detail.items,
  };
}

export type MenuChangeCounts = ReturnType<typeof itemCounts>;

/**
 * The counts of approved queue cards, computed like the detail page: MOD-M1 `newCount`,
 * `editedCount` and `removedCount` compare with the menu on sale, which an approval has already
 * overwritten. One MOD-M1 call per restaurant and one MOD-M2 call per submission (a card and the
 * baseline of another card share it). A card whose loads fail maps to `null`.
 */
export async function loadApprovedCounts(
  service: MenuReviewService,
  cards: readonly Pick<
    ModMenuSubmissionCardDto,
    "id" | "restaurantId" | "reviewedAt"
  >[],
): Promise<Map<number, MenuChangeCounts | null>> {
  const approvedBy = new Map<number, Promise<ModMenuSubmissionCardDto[]>>();
  const details = new Map<number, Promise<ModMenuSubmissionDetailDto>>();
  const approvedOf = (restaurantId: number) => {
    let found = approvedBy.get(restaurantId);
    if (!found) {
      found = listApproved(service, restaurantId);
      approvedBy.set(restaurantId, found);
    }
    return found;
  };
  const detailOf = (submissionId: number) => {
    let found = details.get(submissionId);
    if (!found) {
      found = service.detail(submissionId);
      details.set(submissionId, found);
    }
    return found;
  };
  const results = await Promise.allSettled(
    cards.map(async (card) => {
      const previous = previousApproved(
        await approvedOf(card.restaurantId),
        card,
      );
      const [own, baseline] = await Promise.all([
        detailOf(card.id),
        previous ? detailOf(previous.id) : null,
      ]);
      return itemCounts(
        compareItems(own.items, baseline?.items ?? null),
        own.removedDishes.length,
      );
    }),
  );
  return new Map(
    cards.map((card, index) => {
      const result = results[index];
      return [card.id, result.status === "fulfilled" ? result.value : null];
    }),
  );
}

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
