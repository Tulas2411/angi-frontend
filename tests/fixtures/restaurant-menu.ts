import type {
  MenuDetailDto,
  OwnerMenuDto,
} from "../../src/features/owner/menu-types";

/** API Design v1.8 JSON shapes. Values corrected to match operation semantics/validators. */
export const ownerMenuSample: OwnerMenuDto = {
  dishes: [
    {
      id: 105,
      name: "Bún bò Huế",
      price: 45000,
      coverUrl: null,
      dishForm: "soup",
      isAvailable: true,
      likeCount: 128,
      dislikeCount: 9,
      tags: [{ id: 2, tagType: "meal_time", code: "lunch", name: "Bữa trưa" }],
      restaurant: {
        id: 7,
        name: "Bún Bò Bà Diệu",
        district: null,
        provinceName: "Thành phố Đà Nẵng",
        latitude: 16.067812,
        longitude: 108.220116,
        ratingAvg: 4.6,
      },
      rank: null,
      status: "active",
      sortOrder: 1,
    },
  ],
  openSubmission: null,
};
export const menuDetailSample: MenuDetailDto = {
  id: 14,
  restaurantId: 7,
  status: "draft",
  ownerNote: null,
  submittedAt: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: "2026-10-02T02:00:00Z",
  items: [
    {
      id: 340,
      sourceDishId: 105,
      change: "unchanged",
      name: "Bún bò Huế",
      description: "Bún bò nấu cùng sả và nước dùng đậm đà đặc trưng của Huế.",
      dishForm: "soup",
      price: 45000,
      coverMediaId: null,
      coverUrl: null,
      tagIds: [2],
      sortOrder: 1,
      resultDishId: null,
    },
  ],
  removedDishes: [],
};
