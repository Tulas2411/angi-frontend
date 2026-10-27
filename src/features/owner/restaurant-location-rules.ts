import type {
  OwnerRestaurantDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";

export function restaurantLocationFromProfile(
  restaurant: OwnerRestaurantDto,
): RestaurantLocation | null {
  const { latitude, longitude } = restaurant;
  if (
    latitude === null ||
    longitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return {
    name: restaurant.name,
    latitude,
    longitude,
    address: restaurant.addressLine,
    fullAddress: [
      restaurant.addressLine,
      restaurant.ward,
      restaurant.district,
      restaurant.provinceName,
    ]
      .filter(Boolean)
      .join(", "),
    phone: restaurant.phone ?? undefined,
    website: restaurant.website ?? undefined,
    source: "angi",
    addressContext: {
      region: restaurant.provinceName ?? undefined,
      place: restaurant.district ?? undefined,
      locality: restaurant.ward ?? undefined,
      countryCode: "vn",
    },
  };
}

/** Saving a new pin replaces the address draft; unrelated business fields fill only if blank. */
export function fillRestaurantFromPlace(
  values: RestaurantFormValues,
  point: RestaurantLocation,
): RestaurantFormValues {
  const poi = point.source === "mapbox" && point.featureType === "poi";
  return {
    ...values,
    addressLine: point.address?.trim() || values.addressLine,
    provinceName: point.addressDetails?.provinceName ?? values.provinceName,
    district: point.addressDetails?.district ?? values.district,
    ward: point.addressDetails?.ward ?? values.ward,
    name: poi && !values.name.trim() ? point.name : values.name,
    phone: poi && !values.phone.trim() ? (point.phone ?? "") : values.phone,
    website:
      poi && !values.website.trim() ? (point.website ?? "") : values.website,
  };
}
