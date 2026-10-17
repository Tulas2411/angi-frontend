import type { AppData } from "@/features/platform/contracts";
import type { RestaurantMenuService } from "@/features/owner/menu-service";
import type {
  MenuDetailDto,
  MenuItemDto,
  MenuSubmissionDto,
  MenuTagDto,
  OwnerMenuDto,
} from "@/features/owner/menu-types";
import { ApiError } from "@/shared/api/error";
import { ownerProfileFromDemo } from "./restaurant-profile";
import { createMockRestaurantRegistrationService } from "./restaurant-registration";
import { menuItemRequest, menuItemValues } from "@/features/owner/menu-rules";

/** Numeric IDs are explicit demo IDs; live code never derives IDs from fixture names or URLs. */
export function createMockRestaurantMenuService(
  data: AppData,
  saveAvailability: (id: string, value: boolean) => Promise<void>,
): RestaurantMenuService {
  const restaurant = data.restaurants.find(
    (value) => value.id === data.ownerRestaurantId,
  );
  const dishes = data.dishes.filter(
    (dish) => dish.restaurantId === restaurant?.id,
  );
  const tags: MenuTagDto[] = [
    ...new Set(dishes.flatMap((dish) => dish.tags)),
  ].map((name, index) => ({
    id: index + 1,
    name,
    code: `demo-${index + 1}`,
    tagType: name.startsWith("Bữa ") ? "meal_time" : "category",
  }));
  const sourceIds = new Map(
    dishes.map((dish, index) => [index + 105, dish.id]),
  );
  const menu: OwnerMenuDto = {
    dishes: dishes.map((dish, index) => ({
      id: index + 105,
      name: dish.name,
      price: dish.price,
      coverUrl: dish.image || null,
      dishForm: dish.kind === "water" ? "soup" : dish.kind,
      isAvailable: dish.serving,
      likeCount: 0,
      dislikeCount: 0,
      tags: tags.filter((tag) => dish.tags.includes(tag.name)),
      restaurant: {
        id: 7,
        name: restaurant?.name ?? "",
        district: restaurant?.district ?? null,
        provinceName: restaurant?.province ?? null,
        latitude: restaurant?.latitude ?? null,
        longitude: restaurant?.longitude ?? null,
        ratingAvg: restaurant?.rating ?? 0,
      },
      rank: null,
      status: dish.moderation === "visible" ? "active" : "hidden",
      sortOrder: index,
    })),
    openSubmission: null,
  };
  const submissions = new Map<number, MenuDetailDto>();
  let nextSubmissionId = 13,
    nextItemId = 339;
  const uploader = createMockRestaurantRegistrationService();
  const media = new Map<number, string>(
    menu.dishes.flatMap<[number, string]>((dish) =>
      dish.coverUrl === null ? [] : [[1000000 + dish.id, dish.coverUrl]],
    ),
  );
  const originalItems = new Map<number, MenuItemDto>();
  const notFound = () =>
    new ApiError(404, "RESTAURANT_NOT_FOUND", "Bạn chưa đăng ký nhà hàng.");
  function detail(id: number) {
    const result = submissions.get(id);
    if (!result)
      throw new ApiError(
        404,
        "SUBMISSION_NOT_FOUND",
        "Không tìm thấy bản thực đơn.",
      );
    return result;
  }
  function editable(id: number) {
    const result = detail(id);
    if (result.status !== "draft")
      throw new ApiError(
        409,
        "SUBMISSION_NOT_EDITABLE",
        "Bản thực đơn không còn là nháp.",
      );
    return result;
  }
  function metadata(value: MenuDetailDto): MenuSubmissionDto {
    return {
      id: value.id,
      restaurantId: value.restaurantId,
      status: value.status,
      ownerNote: value.ownerNote,
      submittedAt: value.submittedAt,
      reviewedBy: value.reviewedBy,
      reviewedAt: value.reviewedAt,
      reviewNote: value.reviewNote,
      createdAt: value.createdAt,
    };
  }
  return {
    async getRestaurant() {
      if (!restaurant) throw notFound();
      return ownerProfileFromDemo(restaurant, data.hours);
    },
    async getMenu() {
      if (!restaurant) throw notFound();
      return structuredClone(menu);
    },
    async getTags() {
      return structuredClone(tags);
    },
    async availability(id, value) {
      const dish = menu.dishes.find((value) => value.id === id),
        sourceId = sourceIds.get(id);
      if (!dish || !sourceId)
        throw new ApiError(404, "DISH_NOT_FOUND", "Không tìm thấy món.");
      await saveAvailability(sourceId, value);
      dish.isAvailable = value;
      return { dishId: id, isAvailable: value };
    },
    async create() {
      if (!restaurant) throw notFound();
      if (restaurant.verification !== "verified")
        throw new ApiError(
          403,
          "RESTAURANT_NOT_VERIFIED",
          "Nhà hàng chưa được xác minh.",
        );
      if (menu.openSubmission)
        throw new ApiError(
          409,
          "SUBMISSION_ALREADY_OPEN",
          "Đã có bản thực đơn đang mở.",
          undefined,
          { id: menu.openSubmission.id },
        );
      const result: MenuDetailDto = {
        id: ++nextSubmissionId,
        restaurantId: 7,
        status: "draft",
        ownerNote: null,
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: new Date().toISOString(),
        removedDishes: [],
        items: menu.dishes.map((dish) => ({
          id: ++nextItemId,
          sourceDishId: dish.id,
          change: "unchanged",
          name: dish.name,
          description:
            dishes.find((value) => value.id === sourceIds.get(dish.id))
              ?.description ?? null,
          dishForm: dish.dishForm,
          price: dish.price,
          coverMediaId: dish.coverUrl ? 1000000 + dish.id : null,
          coverUrl: dish.coverUrl,
          tagIds: dish.tags.map((tag) => tag.id),
          sortOrder: dish.sortOrder,
          resultDishId: null,
        })),
      };
      submissions.set(result.id, result);
      result.items.forEach((item) =>
        originalItems.set(item.id, structuredClone(item)),
      );
      menu.openSubmission = { id: result.id, status: "draft" };
      return structuredClone({ ...metadata(result), items: result.items });
    },
    async history(page, pageSize, status) {
      const items = [...submissions.values()]
        .filter((value) => !status || value.status === status)
        .sort((a, b) => b.id - a.id)
        .map(metadata);
      return {
        items: structuredClone(
          items.slice((page - 1) * pageSize, page * pageSize),
        ),
        page,
        pageSize,
        totalItems: items.length,
        totalPages: Math.ceil(items.length / pageSize),
      };
    },
    async detail(id) {
      return structuredClone(detail(id));
    },
    async add(id, body) {
      const result = editable(id);
      const item: MenuItemDto = {
        id: ++nextItemId,
        sourceDishId: null,
        change: "new",
        name: body.name,
        description: body.description,
        dishForm: body.dishForm,
        price: body.price,
        coverMediaId: body.coverMediaId ?? null,
        coverUrl: body.coverMediaId
          ? (media.get(body.coverMediaId) ?? null)
          : null,
        tagIds: body.tagIds ?? [],
        sortOrder:
          body.sortOrder ??
          Math.min(
            32767,
            Math.max(-1, ...result.items.map((value) => value.sortOrder)) + 1,
          ),
        resultDishId: null,
      };
      result.items.push(item);
      return structuredClone(item);
    },
    async update(id, itemId, body) {
      const result = editable(id);
      const item = result.items.find((value) => value.id === itemId);
      if (!item)
        throw new ApiError(
          404,
          "SUBMISSION_ITEM_NOT_FOUND",
          "Không tìm thấy món trong bản nháp.",
        );
      Object.assign(item, structuredClone(body));
      if (body.coverMediaId !== undefined)
        item.coverUrl =
          body.coverMediaId === null
            ? null
            : (media.get(body.coverMediaId) ?? null);
      const original = originalItems.get(item.id);
      item.change =
        item.sourceDishId === null
          ? "new"
          : original &&
              !Object.keys(menuItemRequest(menuItemValues(item), original))
                .length
            ? "unchanged"
            : "edited";
      return structuredClone(item);
    },
    async remove(id, itemId) {
      const result = editable(id),
        item = result.items.find((value) => value.id === itemId);
      if (!item)
        throw new ApiError(
          404,
          "SUBMISSION_ITEM_NOT_FOUND",
          "Không tìm thấy món.",
        );
      result.items = result.items.filter((value) => value.id !== itemId);
      const removed = menu.dishes.find(
        (value) => value.id === item.sourceDishId,
      );
      if (removed) result.removedDishes.push(structuredClone(removed));
      return null;
    },
    async cancel(id) {
      const result = detail(id);
      if (!["draft", "pending"].includes(result.status))
        throw new ApiError(
          409,
          "SUBMISSION_NOT_CANCELLABLE",
          "Không thể hủy bản thực đơn.",
        );
      result.status = "cancelled";
      menu.openSubmission = null;
      return structuredClone(metadata(result));
    },
    async upload(file) {
      const result = { ...(await uploader.upload(file)), purpose: "dish" };
      media.set(result.id, result.url);
      return result;
    },
  };
}
