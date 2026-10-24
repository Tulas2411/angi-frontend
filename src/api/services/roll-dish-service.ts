/**
 * F-18 Roll Dish · DISH-03 + DISH-04 (IMP-01).
 * - POST /dishes/roll                (DISH-03)
 * - POST /impressions                (DISH-04 / IMP-01, gọi sau khi user thấy dish)
 */

import { api } from "@/shared/api/client";
import { fireAndCollect } from "@/shared/api/fire-and-forget";
import type { DishDetailDto } from "./dish-detail-service";

export interface RollDishRequestDto {
  province?: string;
  tagIds?: number[];
  excludeTagIds?: number[];
  mealTime?: "breakfast" | "lunch" | "dinner" | "snack";
  maxPrice?: number;
  excludeDishIds?: number[];
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface RollDishResponseDto {
  rollId: number;
  requestId: string | null;
  dish: DishDetailDto;
}

export interface RecordImpressionsRequestDto {
  requestId?: string;
  dishIds: number[];
  shownAt?: string;
}

export const rollDishService = {
  async roll(request: RollDishRequestDto): Promise<RollDishResponseDto | undefined> {
    return fireAndCollect("dishes.roll", () =>
      api.post<RollDishResponseDto>("dishes/roll", request),
    );
  },

  async recordImpressions(
    request: RecordImpressionsRequestDto,
  ): Promise<void> {
    await fireAndCollect("impressions", () =>
      api.post<{ accepted: boolean }>("impressions", request),
    );
  },
};
