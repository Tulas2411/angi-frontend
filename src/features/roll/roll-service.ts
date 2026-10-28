import { api } from "@/shared/api/client";
import { exploreService } from "@/features/explore/explore-service";
import type {
  BrowseDishesQuery,
  DishCardDto,
  DishDetailDto,
  TagDto,
} from "@/features/explore/explore-types";

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
  radiusKm?: number;
}

/** DISH-03 answer. The backend sends the impression itself (RECO-06), so the app does not. */
export interface RollDishResponseDto {
  rollId: number;
  requestId: string | null;
  dish: DishDetailDto;
}

/**
 * F-18 Roll Dish: DISH-03 picks the dish; DISH-01 fills the spinning strip with real dishes of
 * the same conditions, and CAT-02 finds the tags behind the tabs.
 */
export interface RollService {
  roll(request: RollDishRequestDto): Promise<RollDishResponseDto>;
  strip(query: BrowseDishesQuery): Promise<DishCardDto[]>;
  tags(): Promise<TagDto[]>;
}

export const rollService: RollService = {
  roll: (request) => api.post("dishes/roll", request),
  strip: async (query) => (await exploreService.browseDishes(query)).items,
  tags: () => exploreService.tags(),
};
