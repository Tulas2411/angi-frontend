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

/** V2 codes link provinces directly to wards; no district level is involved. */
export function readProvinceCatalog(payload: unknown): Province[] {
  const items = readCatalog(payload, 99);
  if (!items.length) throw new Error("Empty province catalog.");
  return items;
}

export function readWardCatalog(payload: unknown): Province[] {
  return readCatalog(payload, 99999);
}
