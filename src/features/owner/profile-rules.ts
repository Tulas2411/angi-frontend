import type { Restaurant } from "@/features/platform/contracts";
import type {
  OwnerRestaurantDto,
  RestaurantFormValues,
  UpdateRestaurantRequestDto,
} from "./restaurant-types";

export function profileFormFromRestaurant(
  restaurant: OwnerRestaurantDto,
): RestaurantFormValues {
  return {
    name: restaurant.name,
    phone: restaurant.phone ?? "",
    addressLine: restaurant.addressLine,
    provinceName: restaurant.provinceName ?? "",
    description: restaurant.description ?? "",
    email: restaurant.email ?? "",
    website: restaurant.website ?? "",
    ward: restaurant.ward ?? "",
    priceLevel: restaurant.priceLevel?.toString() ?? "",
  };
}

export function buildProfilePatch(
  values: RestaurantFormValues,
  location: Pick<OwnerRestaurantDto, "latitude" | "longitude"> | null,
  original: OwnerRestaurantDto,
  media: Pick<
    UpdateRestaurantRequestDto,
    "coverMediaId" | "imageMediaIds"
  > = {},
): UpdateRestaurantRequestDto {
  const patch: UpdateRestaurantRequestDto = {};
  for (const key of ["name", "phone", "addressLine", "provinceName"] as const) {
    const value = values[key].trim();
    if (value !== (original[key] ?? "").trim()) patch[key] = value;
  }
  for (const key of ["description", "email", "website", "ward"] as const) {
    const text = values[key].trim();
    const value = (key === "email" ? text.toLowerCase() : text) || null;
    const current = original[key]?.trim() || null;
    if (
      value !== (key === "email" ? (current?.toLowerCase() ?? null) : current)
    )
      patch[key] = value;
  }
  // Clear obsolete district data only when the owner edits administrative areas.
  if (
    original.district &&
    (patch.provinceName !== undefined || patch.ward !== undefined)
  )
    patch.district = null;
  for (const key of ["latitude", "longitude"] as const) {
    const coordinate = location?.[key];
    if (typeof coordinate === "number" && coordinate !== original[key])
      patch[key] = coordinate;
  }
  const priceLevel = values.priceLevel ? Number(values.priceLevel) : null;
  if (priceLevel !== original.priceLevel) patch.priceLevel = priceLevel;
  if (
    media.coverMediaId !== undefined &&
    (media.coverMediaId !== null || original.coverUrl !== null)
  ) {
    patch.coverMediaId = media.coverMediaId;
  }
  if (
    media.imageMediaIds !== undefined &&
    (media.imageMediaIds.length || original.images.length)
  ) {
    patch.imageMediaIds = [...media.imageMediaIds];
  }
  return patch;
}

/** Mirrors the implemented OWN-03 validator: validate only supplied fields. */
export function validateProfilePatch(
  patch: UpdateRestaurantRequestDto,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = {
    name: [200, "Tên nhà hàng"],
    phone: [20, "Số điện thoại"],
    addressLine: [255, "Địa chỉ"],
    provinceName: [100, "Tỉnh / thành phố"],
  } as const;
  for (const key of Object.keys(required) as (keyof typeof required)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    const [limit, label] = required[key];
    if (!value.trim()) errors[key] = `${label} không được để trống.`;
    else if (value.length > limit)
      errors[key] = `${label} không được vượt quá ${limit} ký tự.`;
  }
  if (patch.description && patch.description.length > 2000)
    errors.description = "Mô tả không được vượt quá 2000 ký tự.";
  if (patch.ward && patch.ward.length > 100)
    errors.ward = "Phường / xã không được vượt quá 100 ký tự.";
  if (patch.district && patch.district.length > 100)
    errors.district = "Địa chỉ cũ không được vượt quá 100 ký tự.";
  if (patch.email && !/^[^\s@]+@[^\s@]+$/.test(patch.email))
    errors.email = "Email không đúng định dạng.";
  if (patch.website) {
    try {
      if (!["http:", "https:"].includes(new URL(patch.website).protocol))
        throw new Error();
    } catch {
      errors.website = "Website phải là URL http hoặc https.";
    }
  }
  if (
    patch.priceLevel !== undefined &&
    patch.priceLevel !== null &&
    ![1, 2, 3, 4].includes(patch.priceLevel)
  ) {
    errors.priceLevel = "Mức giá phải từ 1 đến 4.";
  }
  for (const [key, limit] of [
    ["latitude", 90],
    ["longitude", 180],
  ] as const) {
    if (
      patch[key] !== undefined &&
      (!Number.isFinite(patch[key]) || Math.abs(patch[key]) > limit)
    ) {
      errors.location = "Tọa độ nhà hàng không hợp lệ.";
    }
  }
  if (
    patch.coverMediaId !== undefined &&
    patch.coverMediaId !== null &&
    (!Number.isSafeInteger(patch.coverMediaId) || patch.coverMediaId <= 0)
  ) {
    errors.coverMediaId = "Ảnh bìa chưa tải lên thành công.";
  }
  if (
    patch.imageMediaIds !== undefined &&
    (patch.imageMediaIds.length > 10 ||
      new Set(patch.imageMediaIds).size !== patch.imageMediaIds.length ||
      patch.imageMediaIds.some((id) => !Number.isSafeInteger(id) || id <= 0))
  )
    errors.imageMediaIds = "Chọn tối đa 10 ảnh đã tải lên, không trùng nhau.";
  return errors;
}

/** Preserve fixture IDs, related entities, and independently managed statuses. */
export function profileToDemoView(
  current: Restaurant,
  restaurant: OwnerRestaurantDto,
): Restaurant {
  return {
    ...current,
    name: restaurant.name,
    phone: restaurant.phone ?? "",
    address: restaurant.addressLine,
    district: restaurant.district ?? "",
    province: restaurant.provinceName ?? "",
    ward: restaurant.ward ?? "",
    description: restaurant.description ?? "",
    email: restaurant.email ?? "",
    website: restaurant.website ?? "",
    latitude: restaurant.latitude ?? current.latitude,
    longitude: restaurant.longitude ?? current.longitude,
    priceLevel: restaurant.priceLevel,
    image: restaurant.coverUrl ?? "",
    photos: [...restaurant.images],
  };
}
