import { provinceNameKey, type Province } from "@/shared/locations/provinces";
import { searchText } from "@/shared/text/search";
import type { MapLocation } from "@/shared/maps/mapbox";

export function matchMapProvince(
  point: MapLocation,
  provinces: readonly Province[],
): Province | undefined {
  const context = point.addressContext;
  if (context?.countryCode && context.countryCode !== "vn") return;
  for (const candidate of [context?.region, context?.place]) {
    if (!candidate?.trim()) continue;
    const matches = provinces.filter(
      (province) =>
        provinceNameKey(province.name) === provinceNameKey(candidate),
    );
    if (matches.length === 1) return matches[0];
  }
}

/** Do not guess a merged ward or promote Mapbox's district to a ward. */
export function matchMapWard(
  point: MapLocation,
  wards: readonly Province[],
): Province | undefined {
  const context = point.addressContext;
  const explicitWards = (point.fullAddress ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^(phuong|xa|dac khu)\s+/.test(searchText(part)));
  const wardKey = (name: string) =>
    searchText(name).replace(/^(phuong|xa|dac khu)\s+/, "");
  const unit = (name: string) =>
    /^(phuong|xa|dac khu)\s+/.exec(searchText(name))?.[1];
  for (const candidate of [
    context?.locality,
    context?.neighborhood,
    ...explicitWards,
  ]) {
    if (!candidate?.trim()) continue;
    const exact = wards.filter(
      (ward) => searchText(ward.name) === searchText(candidate),
    );
    if (exact.length === 1) return exact[0];
    const matches = wards.filter(
      (ward) =>
        wardKey(ward.name) === wardKey(candidate) &&
        (!unit(candidate) || unit(candidate) === unit(ward.name)),
    );
    if (matches.length === 1) return matches[0];
  }
}
