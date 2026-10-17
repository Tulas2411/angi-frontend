export type DishForm = "soup" | "dry" | "other";
export type MenuStatus =
  "draft" | "pending" | "approved" | "rejected" | "cancelled";
export interface MenuTagDto {
  id: number;
  tagType: "meal_time" | "dietary" | "category";
  code: string;
  name: string;
}
export interface MenuDishDto {
  id: number;
  name: string;
  price: number;
  coverUrl: string | null;
  dishForm: DishForm;
  isAvailable: boolean;
  likeCount: number;
  dislikeCount: number;
  tags: MenuTagDto[];
  restaurant: {
    id: number;
    name: string;
    district: string | null;
    provinceName: string | null;
    latitude: number | null;
    longitude: number | null;
    ratingAvg: number;
  };
  rank: number | null;
}
export interface OwnerMenuDishDto extends MenuDishDto {
  status: "active" | "hidden";
  sortOrder: number;
}
export interface OwnerMenuDto {
  dishes: OwnerMenuDishDto[];
  openSubmission: { id: number; status: "draft" | "pending" } | null;
}
export interface MenuSubmissionDto {
  id: number;
  restaurantId: number;
  status: MenuStatus;
  ownerNote: string | null;
  submittedAt: string | null;
  reviewedBy: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}
/** OWN-17: optional note only; submission ID belongs in the URL. */
export interface SubmitMenuRequestDto {
  ownerNote?: string;
}
export interface MenuItemDto {
  id: number;
  sourceDishId: number | null;
  change: "new" | "edited" | "unchanged";
  name: string;
  description: string | null;
  dishForm: DishForm;
  price: number;
  coverMediaId: number | null;
  coverUrl: string | null;
  tagIds: number[];
  sortOrder: number;
  resultDishId: number | null;
}
export interface MenuWithItemsDto extends MenuSubmissionDto {
  items: MenuItemDto[];
}
export interface MenuDetailDto extends MenuWithItemsDto {
  removedDishes: MenuDishDto[];
}
export interface MenuHistoryDto {
  items: MenuSubmissionDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
export interface AddMenuItemDto {
  name: string;
  description: string;
  dishForm: DishForm;
  price: number;
  coverMediaId?: number | null;
  tagIds?: number[];
  sortOrder?: number;
}
export type PatchMenuItemDto = Partial<AddMenuItemDto>;
export interface MenuItemValues {
  name: string;
  description: string;
  dishForm: DishForm;
  price: string;
  coverMediaId: number | null;
  coverUrl: string | null;
  tagIds: number[];
  sortOrder: string;
}
