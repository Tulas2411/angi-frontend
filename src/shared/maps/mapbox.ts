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
  /** Canonical V2 administrative names, resolved only in an address-entry flow. */
  addressDetails?: { provinceName: string; ward: string };
  addressNotice?: string;
}

export type MapStyle = "streets" | "satellite";
export const mapStyles: Record<MapStyle, string> = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};
export const mapCategories = [
  { id: "restaurant", label: "Nhà hàng" },
  { id: "coffee", label: "Cà phê" },
  { id: "hotel", label: "Khách sạn" },
  { id: "gas_station", label: "Trạm xăng" },
  { id: "atm", label: "ATM" },
  { id: "hospital", label: "Bệnh viện" },
  { id: "supermarket", label: "Siêu thị" },
  { id: "parking", label: "Bãi đỗ xe" },
] as const;

export type RouteProfile = "driving" | "cycling" | "walking";
export interface MapRoute {
  origin: MapLocation;
  destination: MapLocation;
  distance: number;
  duration: number;
  coordinates: [number, number][];
  summary: string;
  steps: { instruction: string; distance: number }[];
}

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

/** Match ANGI records and already loaded basemap POIs without another HTTP request. */
export function filterMapPlaces(
  points: MapLocation[],
  query: string,
  category?: string,
): MapLocation[] {
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  const kinds: Record<string, string[]> = {
    restaurant: ["restaurant", "fast_food"],
    coffee: ["cafe", "coffee"],
    hotel: ["hotel", "lodging"],
    gas_station: ["gas_station", "fuel"],
    atm: ["atm"],
    hospital: ["hospital", "medical"],
    supermarket: ["supermarket", "grocery"],
    parking: ["parking"],
  };
  const seen = new Set<string>();
  return points
    .filter((point) => {
      if (!isMapLocation(point) || seen.has(mapLocationKey(point)))
        return false;
      seen.add(mapLocationKey(point));
      if (category)
        return (
          (category === "restaurant" && point.source === "angi") ||
          (point.categories ?? []).some((kind) =>
            kinds[category]?.some(
              (value) => kind === value || kind.startsWith(`${value}-`),
            ),
          )
        );
      const haystack = normalized(
        [point.name, point.fullAddress, point.address]
          .filter(Boolean)
          .join(" "),
      );
      return words.every((word) => haystack.includes(word));
    })
    .slice(0, 50);
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
  category?: string,
): Promise<MapLocation[]> {
  if (!isMapLocation(near)) throw new Error("Vị trí tìm kiếm không hợp lệ.");
  if (!category && (!query.trim() || query.trim().length > 256))
    throw new Error("Nhập tên địa điểm từ 1 đến 256 ký tự.");
  if (category && !mapCategories.some((item) => item.id === category))
    throw new Error("Danh mục địa điểm không hợp lệ.");
  const params = new URLSearchParams({
    access_token: token,
    country: "vn",
    limit: category ? "15" : "5",
    proximity: `${near.longitude},${near.latitude}`,
  });
  if (!category) params.set("q", query.trim());
  const endpoint = category
    ? `category/${encodeURIComponent(category)}`
    : "forward";
  return readMapPlaces(
    await mapboxJson(
      `https://api.mapbox.com/search/searchbox/v1/${endpoint}?${params}`,
      signal,
    ),
  );
}

export async function getMapRoutes(
  origin: MapLocation,
  destination: MapLocation,
  profile: RouteProfile,
  token: string,
  signal: AbortSignal,
): Promise<MapRoute[]> {
  if (!isMapLocation(origin) || !isMapLocation(destination))
    throw new Error("Chọn điểm xuất phát và điểm đến hợp lệ.");
  if (!["driving", "cycling", "walking"].includes(profile))
    throw new Error("Phương tiện không hợp lệ.");
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    access_token: token,
    alternatives: "true",
    geometries: "geojson",
    overview: "full",
    steps: "true",
    language: "vi",
  });
  const payload = record(
    await mapboxJson(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${params}`,
      signal,
    ),
  );
  if (payload.code === "NoRoute" || payload.code === "NoSegment") return [];
  if (payload.code !== "Ok" || !Array.isArray(payload.routes))
    throw new Error("Chưa lấy được lộ trình. Vui lòng thử lại.");
  return payload.routes.flatMap((value: unknown) => {
    const route = record(value);
    const geometry = record(route.geometry);
    const line = geometry.coordinates;
    if (
      geometry.type !== "LineString" ||
      typeof route.distance !== "number" ||
      !Number.isFinite(route.distance) ||
      route.distance < 0 ||
      typeof route.duration !== "number" ||
      !Number.isFinite(route.duration) ||
      route.duration < 0 ||
      !Array.isArray(line) ||
      line.length < 2
    )
      return [];
    const points: [number, number][] = [];
    for (const coordinate of line) {
      if (
        !Array.isArray(coordinate) ||
        typeof coordinate[0] !== "number" ||
        typeof coordinate[1] !== "number" ||
        !isMapLocation({ longitude: coordinate[0], latitude: coordinate[1] })
      )
        return [];
      points.push([coordinate[0], coordinate[1]]);
    }
    const legs = Array.isArray(route.legs) ? route.legs.map(record) : [];
    return [
      {
        origin,
        destination,
        distance: route.distance,
        duration: route.duration,
        coordinates: points,
        summary: legs
          .map((leg) => textValue(leg.summary))
          .filter(Boolean)
          .join(" · "),
        steps: legs.flatMap((leg) =>
          (Array.isArray(leg.steps) ? leg.steps : []).flatMap(
            (value: unknown) => {
              const step = record(value);
              const instruction = textValue(record(step.maneuver).instruction);
              return instruction &&
                typeof step.distance === "number" &&
                Number.isFinite(step.distance) &&
                step.distance >= 0
                ? [{ instruction, distance: step.distance }]
                : [];
            },
          ),
        ),
      },
    ];
  });
}

export function mapDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
}

/** Mapbox uses a 512-pixel world at zoom 0. Keep clicks in the image's pixel space. */
export function locationFromMapPoint(
  center: MapLocation,
  zoom: number,
  x: number,
  y: number,
): MapLocation {
  const world = 512 * 2 ** zoom;
  const latitude =
    (Math.max(-85, Math.min(85, center.latitude)) * Math.PI) / 180;
  const mercatorY = (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2;
  return {
    name: "Vị trí đã chọn",
    longitude: ((center.longitude + (x / world) * 360 + 540) % 360) - 180,
    latitude: Math.max(
      -85,
      Math.min(
        85,
        (Math.atan(Math.sinh(Math.PI * (1 - 2 * (mercatorY + y / world)))) *
          180) /
          Math.PI,
      ),
    ),
  };
}

export async function searchMapLocations(
  query: string,
  token: string,
  signal: AbortSignal,
): Promise<MapLocation[]> {
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    country: "vn",
    limit: "5",
    autocomplete: "false",
    permanent: "true",
  });
  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      "Chưa tìm được địa chỉ. Bạn có thể chấm trên bản đồ hoặc nhập tọa độ.",
    );
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("features" in payload) ||
    !Array.isArray(payload.features)
  )
    return [];
  return payload.features.flatMap((feature: unknown) => {
    if (
      !feature ||
      typeof feature !== "object" ||
      !("geometry" in feature) ||
      !feature.geometry ||
      typeof feature.geometry !== "object" ||
      !("coordinates" in feature.geometry)
    )
      return [];
    const point = feature.geometry.coordinates;
    if (
      !Array.isArray(point) ||
      typeof point[0] !== "number" ||
      typeof point[1] !== "number" ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      Math.abs(point[0]) > 180 ||
      Math.abs(point[1]) > 90
    )
      return [];
    let name = "Địa chỉ đã tìm";
    if (
      "properties" in feature &&
      feature.properties &&
      typeof feature.properties === "object" &&
      "full_address" in feature.properties &&
      typeof feature.properties.full_address === "string"
    )
      name = feature.properties.full_address;
    return [{ name, longitude: point[0], latitude: point[1] }];
  });
}
