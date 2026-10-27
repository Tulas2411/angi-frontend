export interface MapAddressContext {
  countryCode?: string;
  region?: string;
  place?: string;
  locality?: string;
  neighborhood?: string;
}

export interface MapLocation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  fullAddress?: string;
  phone?: string;
  website?: string;
  categories?: string[];
  source?: "angi" | "mapbox";
  featureType?: string;
  operationalStatus?: string;
  addressContext?: MapAddressContext;
  /** Canonical V1 administrative names, resolved only in an address-entry flow. */
  addressDetails?: { provinceName: string; district: string; ward: string };
  addressNotice?: string;
}

export type MapStyle = "streets" | "satellite";
export const mapStyles: Record<MapStyle, string> = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function readAddressContext(
  properties: Record<string, unknown>,
): MapAddressContext {
  const context = record(properties.context);
  const name = (key: string) =>
    textValue(record(context[key]).name) ??
    (properties.feature_type === key ? textValue(properties.name) : undefined);
  return {
    countryCode: textValue(record(context.country).country_code)?.toLowerCase(),
    region: name("region"),
    place: name("place"),
    locality: name("locality"),
    neighborhood: name("neighborhood"),
  };
}
export function safeMapWebsite(value: unknown): string | undefined {
  const text = textValue(value);
  if (
    !text ||
    (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text))
  )
    return;
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* Provider metadata is optional. */
  }
}
export function isMapLocation(
  point: Pick<MapLocation, "latitude" | "longitude">,
): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}
async function mapboxJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    if (response.status === 429)
      throw new Error(
        "Dịch vụ bản đồ đang giới hạn lượt sử dụng. Vui lòng thử lại sau.",
      );
    if (response.status === 401 || response.status === 403)
      throw new Error("Chưa thể sử dụng dịch vụ bản đồ với cấu hình hiện tại.");
    throw new Error("Không kết nối được dịch vụ bản đồ. Vui lòng thử lại.");
  }
  return response.json();
}

export function mapLocationKey(point: MapLocation): string {
  return `${point.source ?? "point"}:${point.id ?? `${point.longitude},${point.latitude}:${point.name}`}`;
}

/** Temporary Search Box results stay in the current map session, never browser storage. */
export function readMapPlaces(payload: unknown): MapLocation[] {
  const features = record(payload).features;
  if (!Array.isArray(features))
    throw new Error("Dữ liệu địa điểm không hợp lệ.");
  const result: MapLocation[] = [];
  for (const feature of features) {
    const item = record(feature);
    const geometry = record(item.geometry);
    const coordinates = geometry.coordinates;
    const properties = record(item.properties);
    if (
      geometry.type !== "Point" ||
      !Array.isArray(coordinates) ||
      typeof coordinates[0] !== "number" ||
      typeof coordinates[1] !== "number"
    )
      continue;
    const point = { longitude: coordinates[0], latitude: coordinates[1] };
    if (!isMapLocation(point)) continue;
    const metadata = record(properties.metadata);
    const name =
      textValue(properties.name) ?? textValue(properties.full_address);
    if (!name) continue;
    const id =
      textValue(properties.mapbox_id) ??
      `${point.longitude},${point.latitude}:${name}`;
    if (result.some((place) => place.id === id)) continue;
    result.push({
      ...point,
      id,
      name,
      source: "mapbox",
      address: textValue(properties.address),
      fullAddress:
        textValue(properties.full_address) ??
        textValue(properties.place_formatted),
      phone: textValue(metadata.phone),
      website: safeMapWebsite(metadata.website),
      featureType: textValue(properties.feature_type),
      operationalStatus: textValue(properties.operational_status),
      addressContext: readAddressContext(properties),
      categories: Array.isArray(properties.poi_category)
        ? properties.poi_category.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    });
  }
  return result;
}

/** Reverse results describe the pin; their nearby feature coordinates must not move it. */
export function readMapAddress(
  payload: unknown,
  selected: MapLocation,
): MapLocation | null {
  const features = record(payload).features;
  if (!Array.isArray(features))
    throw new Error("Dữ liệu địa chỉ không hợp lệ.");
  const priorities: Record<string, number> = {
    address: 0,
    street: 1,
    neighborhood: 2,
    locality: 3,
    place: 4,
    region: 5,
    country: 6,
  };
  const properties = features
    .flatMap((feature: unknown) => {
      const item = record(feature);
      const geometry = record(item.geometry);
      const coordinates = geometry.coordinates;
      if (
        geometry.type !== "Point" ||
        !Array.isArray(coordinates) ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number" ||
        !isMapLocation({ longitude: coordinates[0], latitude: coordinates[1] })
      )
        return [];
      const value = record(item.properties);
      const context = readAddressContext(value);
      if (context.countryCode && context.countryCode !== "vn") return [];
      return typeof value.feature_type === "string" &&
        Object.hasOwn(priorities, value.feature_type)
        ? [value]
        : [];
    })
    .sort(
      (a, b) =>
        priorities[String(a.feature_type)] - priorities[String(b.feature_type)],
    );
  if (!properties.length) return null;
  const context: MapAddressContext = {};
  for (const item of properties) {
    const next = readAddressContext(item);
    context.countryCode ??= next.countryCode;
    context.region ??= next.region;
    context.place ??= next.place;
    context.locality ??= next.locality;
    context.neighborhood ??= next.neighborhood;
  }
  const detail = properties[0];
  const address = record(record(detail.context).address);
  const addressLine =
    textValue(address.name) ??
    ([textValue(address.address_number), textValue(address.street_name)]
      .filter(Boolean)
      .join(" ") ||
      undefined);
  const street =
    addressLine ??
    (["address", "street"].includes(String(detail.feature_type))
      ? textValue(detail.name)
      : undefined);
  return {
    ...selected,
    address: street,
    fullAddress:
      textValue(detail.full_address) ??
      ([street, textValue(detail.place_formatted)].filter(Boolean).join(", ") ||
        undefined),
    addressContext: context,
  };
}

/** Called only when an Owner saves a new pin, never on map movement or typing. */
export async function reverseMapAddress(
  selected: MapLocation,
  token: string,
  signal: AbortSignal,
): Promise<MapLocation | null> {
  if (!isMapLocation(selected)) throw new Error("Vị trí không hợp lệ.");
  const params = new URLSearchParams({
    longitude: String(selected.longitude),
    latitude: String(selected.latitude),
    access_token: token,
    country: "vn",
    language: "vi",
    permanent: "true",
  });
  return readMapAddress(
    await mapboxJson(
      `https://api.mapbox.com/search/geocode/v6/reverse?${params}`,
      signal,
    ),
    selected,
  );
}

/** One explicit submit = one request. No typeahead, map-move search or automatic fallback. */
export async function searchMapPlaces(
  query: string,
  token: string,
  near: MapLocation,
  signal: AbortSignal,
): Promise<MapLocation[]> {
  if (!isMapLocation(near)) throw new Error("Vị trí tìm kiếm không hợp lệ.");
  if (!query.trim() || query.trim().length > 256)
    throw new Error("Nhập tên địa điểm từ 1 đến 256 ký tự.");
  const params = new URLSearchParams({
    access_token: token,
    country: "vn",
    limit: "5",
    proximity: `${near.longitude},${near.latitude}`,
    q: query.trim(),
  });
  return readMapPlaces(
    await mapboxJson(
      `https://api.mapbox.com/search/searchbox/v1/forward?${params}`,
      signal,
    ),
  );
}
