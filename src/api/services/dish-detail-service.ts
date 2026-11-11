/**
 * F-13 View Dish Detail · DISH-02.
 * - GET /dishes/{dishId}
 */

import { api } from "@/shared/api/client";
import { fireAndCollect } from "@/shared/api/fire-and-forget";

export interface DishDetailDto {
  id: number;
  name: string;
  price: number;
  coverUrl: string | null;
  dishForm: string;
  isAvailable: boolean;
  likeCount: number;
  dislikeCount: number;
  tags: { id: number; name: string; tagType?: string }[];
  rank: number | null;
  description: string | null;
  images: string[];
  status: "active" | "hidden" | "removed";
  restaurant: {
    id: number;
    name: string;
    slug: string;
    coverUrl: string | null;
    addressLine: string;
    district: string | null;
    provinceName: string | null;
    latitude: number;
    longitude: number;
    priceLevel: number | null;
    ratingAvg: number;
    ratingCount: number;
    operatingStatus: string;
    isOpenNow: boolean;
    distanceKm: number | null;
  };
}

export const dishDetailService = {
  async getDetail(dishId: number): Promise<DishDetailDto | undefined> {
    return fireAndCollect("dishes.detail", () =>
      api.get<DishDetailDto>(`dishes/${dishId}`),
    );
  },
};
