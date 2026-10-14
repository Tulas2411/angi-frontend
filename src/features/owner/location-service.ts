import type { RestaurantLocation } from "./restaurant-types";

/** Mapbox uses a 512-pixel world at zoom 0. Keep clicks in the image's pixel space. */
export function locationFromMapPoint(
  center: RestaurantLocation,
  zoom: number,
  x: number,
  y: number,
): RestaurantLocation {
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

export async function searchRestaurantLocations(
  query: string,
  token: string,
  signal: AbortSignal,
): Promise<RestaurantLocation[]> {
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
