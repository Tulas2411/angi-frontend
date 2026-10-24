/**
 * F-12 Browse Dish · DISH-01.
 * - GET /dishes?q=&tagIds=&dishForm=&minPrice=&maxPrice=&restaurantId=&lat=&lng=&radiusKm=&cursor=&limit=
 *
 * Gọi nền khi user mở trang discovery/dishes; UI vẫn dùng `data.dishes` từ mock.
 */

import { api } from "@/shared/api/client";
import { fireAndCollect } from "@/shared/api/fire-and-forget";

export interface BrowseDishesRequestDto {
  q?: string;
  province?: string;
  district?: string;
  tagIds?: number[];
  excludeTagIds?: number[];
  dishForm?: "soup" | "dry" | "other";
  minPrice?: number;
  maxPrice?: number;
  restaurantId?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  cursor?: string;
  limit?: number;
}

export interface DishCardDto {
  id: number;
  name: string;
  price: number;
  coverUrl: string | null;
  dishForm: string;
  isAvailable: boolean;
  likeCount: number;
  dislikeCount: number;
  tags: { id: number; name: string; tagType?: string }[];
  restaurant: {
    id: number;
    name: string;
    district: string | null;
    provinceName: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  rank: number | null;
}

export interface BrowseDishesResponseDto {
  requestId: string | null;
  items: DishCardDto[];
  nextCursor: string | null;
}

export const dishBrowseService = {
  async browse(
    request: BrowseDishesRequestDto,
  ): Promise<BrowseDishesResponseDto | undefined> {
    const query = buildQueryString(request);
    return fireAndCollect("dishes.browse", () =>
      api.get<BrowseDishesResponseDto>(`dishes${query}`),
    );
  },
};

function buildQueryString(request: BrowseDishesRequestDto): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
