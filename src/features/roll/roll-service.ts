import { api } from "@/shared/api/client";
import { exploreService } from "@/features/explore/explore-service";
import type { DishDetailDto, TagDto } from "@/features/explore/explore-types";

export type RollMealTime = "breakfast" | "lunch" | "dinner" | "snack";

/** DISH-03 request (API Design v1.8, RollDishRequestDto). Every condition is optional. */
export interface RollDishRequestDto {
  province?: string;
  tagIds?: number[];
  excludeTagIds?: number[];
  mealTime?: RollMealTime;
  maxPrice?: number;
  /** At most 50. */
  excludeDishIds?: number[];
  latitude?: number;
  longitude?: number;
  /** 0.5..50, default 3; needs latitude and longitude. */
  radiusKm?: number;
}

/** DISH-03 answer. The backend sends the impression itself (RECO-06), so the app does not. */
export interface RollDishResponseDto {
  rollId: number;
  requestId: string | null;
  dish: DishDetailDto;
}

export interface RollService {
  roll(request: RollDishRequestDto): Promise<RollDishResponseDto>;
  tags(): Promise<TagDto[]>;
}

export const rollService: RollService = {
  roll: (request) => api.post("dishes/roll", request),
  tags: () => exploreService.tags(),
};
