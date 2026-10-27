import { searchText } from "@/shared/text/search";

export interface Province {
  code: number;
  name: string;
}

export function provinceNameKey(value: string): string {
  return searchText(value).replace(/^(tinh|thanh pho)\s+/, "");
}

function readCatalog(payload: unknown, maxCode: number): Province[] {
  if (!Array.isArray(payload))
    throw new Error("Invalid administrative catalog.");
  const items = new Map<number, Province>();
  for (const item of payload) {
    if (
      !item ||
      typeof item !== "object" ||
      !("code" in item) ||
      typeof item.code !== "number" ||
      !Number.isInteger(item.code) ||
      item.code < 1 ||
      item.code > maxCode ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.trim().length > 100
    )
      throw new Error("Invalid administrative catalog.");
    const name = item.name.trim();
    if (items.has(item.code) && items.get(item.code)?.name !== name)
      throw new Error("Conflicting administrative code.");
    items.set(item.code, { code: item.code, name });
  }
  return [...items.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "vi"),
  );
}

/**
 * The three-level catalog from before the 2025 merger (provinces.open-api.vn V1): 63 provinces,
 * their districts, and the wards of each district. OWN-01 requires the district.
 */
export function readProvinceCatalog(payload: unknown): Province[] {
  const items = readCatalog(payload, 99);
  if (!items.length) throw new Error("Empty province catalog.");
  return items;
}

export function readDistrictCatalog(payload: unknown): Province[] {
  return readCatalog(payload, 999);
}

export function readWardCatalog(payload: unknown): Province[] {
  return readCatalog(payload, 99999);
}

/** "Quận Hải Châu" and "Hải Châu" are the same district. */
export function districtNameKey(value: string): string {
  return searchText(value).replace(/^(quan|huyen|thi xa|thanh pho)\s+/, "");
}
