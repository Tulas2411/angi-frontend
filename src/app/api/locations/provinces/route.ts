import { ApiError } from "@/shared/api/error";
import { fail, ok } from "@/shared/api/http";

/** V1 catalog matches the current contract's required district and legacy address model. */
export async function GET() {
  try {
    const response = await fetch("https://provinces.open-api.vn/api/v1/", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error();
    const provinces = payload.flatMap((item: unknown) =>
      item &&
      typeof item === "object" &&
      "name" in item &&
      typeof item.name === "string"
        ? [{ name: item.name }]
        : [],
    );
    if (!provinces.length) throw new Error();
    return ok(provinces);
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
