import { afterEach, describe, expect, it, vi } from "vitest";
import { verificationService } from "@/features/owner/verification-service";
import {
  buildVerificationRequest,
  resubmittableVerification,
  validateVerificationRequest,
  verificationResubmissionDraft,
  verificationErrorMessage,
} from "@/features/owner/verification-rules";
import { ApiError } from "@/shared/api/error";
import { verificationHistoryFixture } from "./fixtures/verification-history";
import { ownerRestaurantSample } from "./fixtures/owner-restaurant";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = {
  legalName: "Hộ kinh doanh Bún Bò Bà Diệu",
  businessLicenseNo: "32A8012345",
  taxCode: "0401234567",
  ownerNote: "Đã bổ sung giấy ATTP theo yêu cầu",
  documents: [{ docType: "food_safety_cert" as const, mediaId: 9001 }],
};
function fixture(status: "rejected" | "needs_more_info" = "needs_more_info") {
  const history = verificationHistoryFixture(status);
  const restaurant = {
    ...ownerRestaurantSample,
    verificationStatus: history.verificationStatus,
    latestVerification: history.items[0],
  };
  return { history, restaurant };
}

describe("F-49 / OWN-08 resubmission", () => {
  it("uses the exact id-scoped POST and unwraps the 201 response", async () => {
    const result = {
      ...verificationHistoryFixture().items[0],
      id: 24,
      previousId: 23,
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: null,
          errorCode: null,
          data: result,
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    expect(await verificationService.resubmit(23, request)).toEqual(result);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toMatch(
      /\/backend\/owner\/restaurant\/verifications\/23\/resubmit$/,
    );
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(request);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("requires a complete nonempty dossier but allows a food safety certificate without a license document", () => {
    expect(validateVerificationRequest(request, "resubmit")).toEqual({});
    expect(validateVerificationRequest(request)).toHaveProperty("documents");
    expect(
      validateVerificationRequest({ ...request, documents: [] }, "resubmit"),
    ).toHaveProperty("documents");
    expect(
      validateVerificationRequest(
        { ...request, legalName: " ", businessLicenseNo: "" },
        "resubmit",
      ),
    ).toHaveProperty("legalName");
    for (const [field, limit] of [
      ["legalName", 255],
      ["businessLicenseNo", 50],
      ["taxCode", 20],
      ["ownerNote", 1000],
    ] as const) {
      expect(
        validateVerificationRequest(
          { ...request, [field]: "x".repeat(limit) },
          "resubmit",
        ),
      ).toEqual({});
      expect(
        validateVerificationRequest(
          { ...request, [field]: "x".repeat(limit + 1) },
          "resubmit",
        ),
      ).toHaveProperty(field);
    }
  });
  it("prefills independent legal values and retained IDs without inventing media metadata", () => {
    const previous = fixture().history.items[0];
    const original = structuredClone(previous);
    const draft = verificationResubmissionDraft(previous);
    const selection = draft.documents[0];
    expect(selection).toMatchObject({
      retained: true,
      media: { id: 9001, url: "" },
    });
    expect(selection.media).not.toHaveProperty("mimeType");
    expect(selection.media).not.toHaveProperty("sizeBytes");
    draft.values.legalName = "Tên đã sửa";
    selection.docType = "food_safety_cert";
    expect(
      buildVerificationRequest(draft.values, draft.documents),
    ).toMatchObject({
      legalName: "Tên đã sửa",
      documents: [{ docType: "food_safety_cert", mediaId: 9001 }],
    });
    expect(previous).toEqual(original);
  });
  it("matches both latest-attempt and restaurant eligibility, including unverified with a reviewed attempt", () => {
    const { restaurant } = fixture();
    expect(resubmittableVerification(restaurant)?.id).toBe(23);
    expect(
      resubmittableVerification({
        ...restaurant,
        verificationStatus: "unverified",
      })?.id,
    ).toBe(23);
    for (const verificationStatus of ["pending", "verified"] as const)
      expect(
        resubmittableVerification({ ...restaurant, verificationStatus }),
      ).toBeNull();
    for (const status of ["pending", "approved", "cancelled"] as const)
      expect(
        resubmittableVerification({
          ...restaurant,
          latestVerification: { ...restaurant.latestVerification, status },
        }),
      ).toBeNull();
    expect(
      resubmittableVerification({ ...restaurant, latestVerification: null }),
    ).toBeNull();
  });
  it("explains stale/missing submissions with actionable messages", () => {
    for (const code of [
      "VERIFICATION_NOT_RESUBMITTABLE",
      "VERIFICATION_NOT_FOUND",
    ])
      expect(
        verificationErrorMessage(new ApiError(409, code, "opaque")),
      ).toMatch(/Tải lại trạng thái/);
  });
});
