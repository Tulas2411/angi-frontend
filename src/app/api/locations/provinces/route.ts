import { ApiError } from "@/shared/api/error";
import { fail, ok } from "@/shared/api/http";
import { readProvinceCatalog } from "@/shared/locations/provinces";

/** Current two-level administrative catalog after the July 2025 merger. */
export async function GET() {
  try {
    const response = await fetch("https://provinces.open-api.vn/api/v2/", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    return ok(readProvinceCatalog(payload));
  } catch {
    return fail(
      new ApiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Chưa tải được gợi ý tỉnh/thành. Bạn có thể nhập tên đầy đủ.",
      ),
    );
  }
}
