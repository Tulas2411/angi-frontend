import { ApiError } from "@/shared/api/error";
import { fail, ok } from "@/shared/api/http";
import { readWardCatalog } from "@/shared/locations/provinces";

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
    // Fetch only the selected province, rather than the entire national ward tree.
    const response = await fetch(
      `https://provinces.open-api.vn/api/v2/p/${code}?depth=2`,
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
          !("province_code" in ward) ||
          ward.province_code !== Number(code),
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
