/**
 * Wire DTOs of F-58 Review Pending Menu Submission (API Design v1.8: MOD-M1..MOD-M4; BE
 * `ModMenuSubmissionCardDto`, `ModMenuSubmissionDetailDto`, `ModMenuItemDiffDto`).
 */
import type {
  MenuDishDto,
  MenuItemDto,
  MenuSubmissionDto,
} from "@/features/owner/menu-types";

/** DTO "RestaurantMini" (BE sends `ward`; the address is province + ward since 07/2025). */
export interface ModRestaurantMiniDto {
  id: number;
  name: string;
  ward?: string | null;
  provinceName: string | null;
  latitude: number | null;
  longitude: number | null;
  ratingAvg: number;
}

/** MOD-M1 item: the submission with its restaurant and how many dishes change. */
export interface ModMenuSubmissionCardDto extends MenuSubmissionDto {
  restaurant: ModRestaurantMiniDto;
  newCount: number;
  editedCount: number;
  removedCount: number;
}

/** MOD-M2 item: the submitted dish and, for an edited one, the dish on sale now. */
export interface ModMenuItemDiffDto extends MenuItemDto {
  before: MenuDishDto | null;
}

/** MOD-M2: the submission compared with the running menu. */
export interface ModMenuSubmissionDetailDto extends MenuSubmissionDto {
  restaurant: ModRestaurantMiniDto;
  items: ModMenuItemDiffDto[];
  removedDishes: MenuDishDto[];
}

export interface ModMenuSubmissionsPageDto {
  items: ModMenuSubmissionCardDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type MenuQueueStatus = "pending" | "approved" | "rejected";
export interface ListMenuSubmissionsQuery {
  status: MenuQueueStatus;
  restaurantId?: number;
  page?: number;
  pageSize?: number;
}

/** MOD-M3 answer: the submission and the dishes the approval created, updated and removed. */
export interface ApproveMenuSubmissionResponseDto extends MenuSubmissionDto {
  createdDishIds: number[];
  updatedDishIds: number[];
  removedDishIds: number[];
}
