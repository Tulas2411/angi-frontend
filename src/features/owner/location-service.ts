import { reverseMapAddress, type MapLocation } from "@/shared/maps/mapbox";
import { loadProvinceCatalog } from "@/shared/locations/province-service";
import {
  loadDistrictCatalog,
  loadWardCatalog,
} from "@/shared/locations/ward-service";
import {
  matchMapDistrict,
  matchMapProvince,
  matchMapWard,
} from "./restaurant-address-rules";

/** At most one reverse lookup per explicit save; a previously resolved pin is reused. */
export async function resolveRestaurantAddress(
  point: MapLocation,
  token: string | undefined,
  signal: AbortSignal,
): Promise<MapLocation> {
  signal.throwIfAborted();
  if (
    point.address &&
    point.addressDetails?.provinceName &&
    point.addressDetails.district &&
    point.addressDetails.ward
  )
    return point;
  const manualNotice =
    "Đã lưu tọa độ. Chưa tự lấy được địa chỉ; bạn hãy kiểm tra và bổ sung các ô địa chỉ.";
  if (!token?.startsWith("pk."))
    return { ...point, addressNotice: manualNotice };
  let resolved = point;
  try {
    const address = await reverseMapAddress(
      point,
      token,
      AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    );
    signal.throwIfAborted();
    if (address)
      resolved = { ...address, address: address.address ?? point.address };
  } catch {
    signal.throwIfAborted();
    // A missing address must not prevent the Owner from saving their own coordinates.
  }
  if (!resolved.addressContext?.region && !resolved.addressContext?.place)
    return { ...resolved, addressNotice: manualNotice };
  try {
    const provinces = await loadProvinceCatalog();
    signal.throwIfAborted();
    const province = matchMapProvince(resolved, provinces);
    if (!province)
      return {
        ...resolved,
        addressDetails: { provinceName: "", district: "", ward: "" },
        addressNotice: resolved.address
          ? "Đã điền địa chỉ. Chưa đối chiếu được tỉnh/thành, quận/huyện và phường/xã; bạn hãy chọn lại từ gợi ý."
          : manualNotice,
      };
    let districtName = "";
    let wardName = "";
    try {
      const districts = await loadDistrictCatalog(province.code);
      signal.throwIfAborted();
      const district = matchMapDistrict(resolved, districts);
      districtName = district?.name ?? "";
      if (district) {
        const wards = await loadWardCatalog(district.code);
        signal.throwIfAborted();
        wardName = matchMapWard(resolved, wards)?.name ?? "";
      }
    } catch {
      signal.throwIfAborted();
    }
    return {
      ...resolved,
      addressDetails: {
        provinceName: province.name,
        district: districtName,
        ward: wardName,
      },
      addressNotice:
        resolved.address && districtName && wardName
          ? "Đã điền địa chỉ theo vị trí đã chọn. Bạn có thể chỉnh lại số nhà hoặc thông tin chi tiết trước khi lưu nhà hàng."
          : "Đã điền những thông tin địa chỉ tìm được. Bạn hãy kiểm tra và bổ sung phần còn thiếu, đặc biệt quận/huyện và phường/xã.",
    };
  } catch {
    signal.throwIfAborted();
    return {
      ...resolved,
      addressNotice: resolved.address
        ? "Đã điền địa chỉ. Chưa tải được danh mục hành chính; bạn hãy kiểm tra tỉnh/thành, quận/huyện và phường/xã."
        : manualNotice,
    };
  }
}
