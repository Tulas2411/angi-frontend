import { searchText } from "@/shared/text/search";

/** A provider's full province name can match existing records using short names. */
export function matchesRestaurantLocation(
  restaurant: {
    name: string;
    address: string;
    district: string;
    province: string;
  },
  query: string,
): boolean {
  const term = searchText(query);
  const province = (value: string) =>
    searchText(value).replace(/^(tinh|thanh pho)\s+/, "");
  return (
    searchText(
      `${restaurant.name} ${restaurant.address} ${restaurant.district} ${restaurant.province}`,
    ).includes(term) || province(restaurant.province) === province(query)
  );
}
