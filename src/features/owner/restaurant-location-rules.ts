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
      restaurant.provinceName,
    ]
      .filter(Boolean)
      .join(", "),
    phone: restaurant.phone ?? undefined,
    website: restaurant.website ?? undefined,
    source: "angi",
  };
}

/** Only fill blank draft fields after the owner explicitly saves a POI selection. */
export function fillRestaurantFromPlace(
  values: RestaurantFormValues,
  point: RestaurantLocation,
): RestaurantFormValues {
  if (point.source !== "mapbox" || point.featureType !== "poi") return values;
  return {
    ...values,
    name: values.name.trim() ? values.name : point.name,
    addressLine: values.addressLine.trim()
      ? values.addressLine
      : (point.address ?? ""),
    phone: values.phone.trim() ? values.phone : (point.phone ?? ""),
    website: values.website.trim() ? values.website : (point.website ?? ""),
  };
}
