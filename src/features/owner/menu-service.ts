import { api } from "@/shared/api/client";
import type { MediaFileDto, OwnerRestaurantDto } from "./restaurant-types";
import type {
  AddMenuItemDto,
  MenuDetailDto,
  MenuHistoryDto,
  MenuItemDto,
  MenuStatus,
  MenuSubmissionDto,
  MenuTagDto,
  MenuWithItemsDto,
  OwnerMenuDto,
  PatchMenuItemDto,
  SubmitMenuRequestDto,
} from "./menu-types";
export interface RestaurantMenuService {
  getRestaurant(): Promise<OwnerRestaurantDto>;
  getMenu(): Promise<OwnerMenuDto>;
  getTags(): Promise<MenuTagDto[]>;
  availability(
    dishId: number,
    isAvailable: boolean,
  ): Promise<{ dishId: number; isAvailable: boolean }>;
  create(): Promise<MenuWithItemsDto>;
  history(
    page: number,
    pageSize: number,
    status?: MenuStatus,
  ): Promise<MenuHistoryDto>;
  detail(id: number): Promise<MenuDetailDto>;
  add(id: number, body: AddMenuItemDto): Promise<MenuItemDto>;
  update(
    id: number,
    itemId: number,
    body: PatchMenuItemDto,
  ): Promise<MenuItemDto>;
  remove(id: number, itemId: number): Promise<null>;
  cancel(id: number): Promise<MenuSubmissionDto>;
  submit(id: number, body: SubmitMenuRequestDto): Promise<MenuSubmissionDto>;
  upload(file: File): Promise<MediaFileDto>;
}
const base = "owner/restaurant/menu-submissions";
export const restaurantMenuService: RestaurantMenuService = {
  getRestaurant: () => api.get("owner/restaurant"),
  getMenu: () => api.get("owner/restaurant/menu"),
  getTags: () => api.get("tags"),
  availability: (id, isAvailable) =>
    api.put(`owner/restaurant/menu/dishes/${id}/availability`, { isAvailable }),
  create: () => api.post(base),
  history: (page, pageSize, status) => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status) query.set("status", status);
    return api.get(`${base}?${query}`);
  },
  detail: (id) => api.get(`${base}/${id}`),
  add: (id, body) => api.post(`${base}/${id}/items`, body),
  update: (id, itemId, body) =>
    api.patch(`${base}/${id}/items/${itemId}`, body),
  remove: (id, itemId) => api.delete(`${base}/${id}/items/${itemId}`),
  cancel: (id) => api.post(`${base}/${id}/cancel`),
  submit: (id, body) => api.post(`${base}/${id}/submit`, body),
  upload: (file) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "dish");
    return api.upload("media", body);
  },
};
