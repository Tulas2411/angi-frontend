import type {
  OwnerRestaurantDto,
  RestaurantFormValues,
  RestaurantLocation,
} from "./restaurant-types";
import { provinceNameKey } from "@/shared/locations/provinces";
import { loadProvinceCatalog } from "@/shared/locations/province-service";
import { loadWardCatalog } from "@/shared/locations/ward-service";
import { searchText } from "@/shared/text/search";

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
    addressContext: {
      region: restaurant.provinceName ?? undefined,
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
    ward: point.addressDetails?.ward ?? values.ward,
    name: poi && !values.name.trim() ? point.name : values.name,
    phone: poi && !values.phone.trim() ? (point.phone ?? "") : values.phone,
    website:
      poi && !values.website.trim() ? (point.website ?? "") : values.website,
  };
}

/** A ward name without its level, so "Phường Hàng Bạc" and "Hàng Bạc" compare equal. */
const wardKey = (value: string) =>
  searchText(value).replace(/^(phuong|xa|thi tran|dac khu)\s+/, "");

/**
 * The province and ward a map pick filled in, as named in the administrative catalog the address
 * fields pick from (only catalog names are accepted there). A name the catalog does not know is
 * dropped so the owner picks it; if a catalog cannot be loaded the names are kept as they are.
 */
export async function catalogAddress(
  provinceName: string,
  ward: string,
): Promise<{ provinceName: string; ward: string }> {
  let provinces;
  try {
    provinces = await loadProvinceCatalog();
  } catch {
    return { provinceName, ward };
  }
  const province = provinces.find(
    (item) => provinceNameKey(item.name) === provinceNameKey(provinceName),
  );
  if (!province) return { provinceName: "", ward: "" };
  if (!ward.trim()) return { provinceName: province.name, ward: "" };
  try {
    const wards = await loadWardCatalog(province.code);
    const match = wards.find((item) => wardKey(item.name) === wardKey(ward));
    return { provinceName: province.name, ward: match?.name ?? "" };
  } catch {
    return { provinceName: province.name, ward };
  }
}
