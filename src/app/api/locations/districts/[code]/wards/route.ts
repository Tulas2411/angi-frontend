import { ApiError } from "@/shared/api/error";
import { fail, ok } from "@/shared/api/http";
import { readWardCatalog } from "@/shared/locations/provinces";

/** Wards of one V1 district (pre-merger catalog); only that district is fetched. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^[1-9]\d{0,2}$/.test(code))
    return fail(
      new ApiError(400, "BAD_REQUEST", "Mã quận/huyện không hợp lệ."),
    );
  try {
    const response = await fetch(
      `https://provinces.open-api.vn/api/v1/d/${code}?depth=2`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !("code" in payload) ||
      payload.code !== Number(code) ||
      !("wards" in payload) ||
      !Array.isArray(payload.wards) ||
      payload.wards.some(
        (ward: unknown) =>
          !ward ||
          typeof ward !== "object" ||
          !("district_code" in ward) ||
          ward.district_code !== Number(code),
      )
    )
      throw new Error();
    return ok(readWardCatalog(payload.wards));
  } catch {
    return fail(
      new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Chưa tải được gợi ý phường/xã. Bạn có thể nhập tên đầy đủ.",
      ),
    );
  }
}
