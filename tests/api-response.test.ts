import { describe, expect, it } from "vitest";
import { ApiError, getErrorMessage, readApiResponse } from "@/shared/api/error";

function response(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}
describe("ANGI ApiResponse", () => {
  it("unwraps data and supports null data for logout", async () => {
    await expect(
      readApiResponse(response({ success: true, data: { id: 4 } })),
    ).resolves.toEqual({ id: 4 });
    await expect(
      readApiResponse(response({ success: true, data: null })),
    ).resolves.toBeNull();
  });
  it("preserves field validation and structured account error data", async () => {
    const errors = { email: ["Email không hợp lệ"] };
    await expect(
      readApiResponse(
        response(
          {
            success: false,
            errorCode: "VALIDATION_FAILED",
            message: "Invalid",
            errors,
            data: null,
          },
          400,
        ),
      ),
    ).rejects.toMatchObject({
      status: 400,
      errorCode: "VALIDATION_FAILED",
      errors,
    });
    const data = { suspendedUntil: "2030-01-01T00:00:00Z" };
    await expect(
      readApiResponse(
        response(
          {
            success: false,
            errorCode: "ACCOUNT_SUSPENDED",
            message: "Suspended",
            data,
          },
          403,
        ),
      ),
    ).rejects.toMatchObject({ data });
  });
  it("preserves Retry-After", async () => {
    await expect(
      readApiResponse(
        response(
          { success: false, errorCode: "TOO_MANY_REQUESTS", data: null },
          429,
          { "Retry-After": "60" },
        ),
      ),
    ).rejects.toMatchObject({ retryAfter: "60" });
    expect(
      getErrorMessage(
        new ApiError(429, "TOO_MANY_REQUESTS", "", undefined, null, "60"),
      ),
    ).toContain("60");
  });
  it("rejects malformed success responses and retains HTTP failures", async () => {
    await expect(
      readApiResponse(response({ success: true })),
    ).rejects.toMatchObject({ errorCode: "INVALID_RESPONSE" });
    await expect(
      readApiResponse(new Response("Bad gateway", { status: 503 })),
    ).rejects.toMatchObject({ status: 503 });
  });
});
