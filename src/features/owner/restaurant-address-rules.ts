import {
  districtNameKey,
  provinceNameKey,
  type Province,
} from "@/shared/locations/provinces";
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

/** Mapbox names the district as its `place`, or the full address carries "Quận …" / "Huyện …". */
export function matchMapDistrict(
  point: MapLocation,
  districts: readonly Province[],
): Province | undefined {
  const context = point.addressContext;
  const explicit = (point.fullAddress ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) =>
      /^(quan|huyen|thi xa|thanh pho)\s+/.test(searchText(part)),
    );
  for (const candidate of [context?.place, ...explicit]) {
    if (!candidate?.trim()) continue;
    const matches = districts.filter(
      (district) =>
        districtNameKey(district.name) === districtNameKey(candidate),
    );
    if (matches.length === 1) return matches[0];
  }
}

/** Only a ward named by the map or the address is taken; a district is never promoted to a ward. */
export function matchMapWard(
  point: MapLocation,
  wards: readonly Province[],
): Province | undefined {
  const context = point.addressContext;
  const explicitWards = (point.fullAddress ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^(phuong|xa|thi tran)\s+/.test(searchText(part)));
  const wardKey = (name: string) =>
    searchText(name).replace(/^(phuong|xa|thi tran)\s+/, "");
  const unit = (name: string) =>
    /^(phuong|xa|thi tran)\s+/.exec(searchText(name))?.[1];
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
