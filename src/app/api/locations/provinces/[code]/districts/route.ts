import { ApiError } from "@/shared/api/error";
import { fail, ok } from "@/shared/api/http";
import { readDistrictCatalog } from "@/shared/locations/provinces";

/** Districts of one V1 province (pre-merger catalog); only that province is fetched. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^[1-9]\d?$/.test(code))
    return fail(
      new ApiError(400, "BAD_REQUEST", "Mã tỉnh/thành không hợp lệ."),
    );
  try {
    const response = await fetch(
      `https://provinces.open-api.vn/api/v1/p/${code}?depth=2`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !("code" in payload) ||
      payload.code !== Number(code) ||
      !("districts" in payload) ||
      !Array.isArray(payload.districts) ||
      payload.districts.some(
        (district: unknown) =>
          !district ||
          typeof district !== "object" ||
          !("province_code" in district) ||
          district.province_code !== Number(code),
      )
    )
      throw new Error();
    return ok(readDistrictCatalog(payload.districts));
  } catch {
    return fail(
      new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Chưa tải được gợi ý quận/huyện. Bạn có thể nhập tên đầy đủ.",
      ),
    );
  }
}
