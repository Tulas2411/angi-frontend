import { provinceNameKey } from "./provinces";

/**
 * Where to centre a map on a province of the V2 catalog (the 34 units of the 2025 reform,
 * provinces.open-api.vn/api/v2): the city that holds its administrative centre. Used only to
 * frame a map (no geocoding request), so city-level accuracy is enough.
 */
const centers: readonly [name: string, latitude: number, longitude: number][] =
  [
    ["Thành phố Hà Nội", 21.0285, 105.8542],
    ["Thành phố Huế", 16.4637, 107.5909],
    ["Tỉnh Lai Châu", 22.3964, 103.4582],
    ["Tỉnh Điện Biên", 21.386, 103.023],
    ["Tỉnh Sơn La", 21.327, 103.9141],
    ["Tỉnh Lạng Sơn", 21.8537, 106.7615],
    ["Tỉnh Quảng Ninh", 20.9599, 107.0425],
    ["Tỉnh Thanh Hóa", 19.8067, 105.7852],
    ["Tỉnh Nghệ An", 18.6796, 105.6813],
    ["Tỉnh Hà Tĩnh", 18.3428, 105.9057],
    ["Tỉnh Cao Bằng", 22.6657, 106.258],
    ["Tỉnh Tuyên Quang", 21.8236, 105.214],
    ["Tỉnh Lào Cai", 21.7229, 104.9113],
    ["Tỉnh Thái Nguyên", 21.5942, 105.8482],
    ["Tỉnh Phú Thọ", 21.3227, 105.4019],
    ["Tỉnh Bắc Ninh", 21.2731, 106.1946],
    ["Tỉnh Hưng Yên", 20.6464, 106.0511],
    ["Thành phố Hải Phòng", 20.8449, 106.6881],
    ["Tỉnh Ninh Bình", 20.2506, 105.9745],
    ["Tỉnh Quảng Trị", 17.4689, 106.6223],
    ["Thành phố Đà Nẵng", 16.0544, 108.2022],
    ["Tỉnh Quảng Ngãi", 15.1205, 108.7923],
    ["Tỉnh Gia Lai", 13.782, 109.2192],
    ["Tỉnh Khánh Hòa", 12.2388, 109.1967],
    ["Tỉnh Lâm Đồng", 11.9404, 108.4583],
    ["Tỉnh Đắk Lắk", 12.6667, 108.05],
    ["Thành phố Hồ Chí Minh", 10.7769, 106.7009],
    ["Tỉnh Đồng Nai", 10.9574, 106.8426],
    ["Tỉnh Tây Ninh", 10.536, 106.413],
    ["Thành phố Cần Thơ", 10.0452, 105.7469],
    ["Tỉnh Vĩnh Long", 10.2537, 105.9722],
    ["Tỉnh Đồng Tháp", 10.36, 106.36],
    ["Tỉnh Cà Mau", 9.1769, 105.1524],
    ["Tỉnh An Giang", 10.0125, 105.0809],
  ];

const byKey = new Map(
  centers.map(([name, latitude, longitude]) => [
    provinceNameKey(name),
    { latitude, longitude },
  ]),
);

/**
 * The centre of a province named as the catalog, a restaurant or the traveler wrote it
 * ("Thành phố Hà Nội", "Hà Nội", "tỉnh gia lai"); null for a name outside the 34.
 */
export function provinceCenter(
  name: string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!name?.trim()) return null;
  return byKey.get(provinceNameKey(name.trim())) ?? null;
}
