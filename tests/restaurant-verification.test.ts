import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVerificationRequest,
  validateVerificationFile,
  validateVerificationRequest,
  verificationDocumentTypes,
  verificationFieldErrors,
  verificationSubmissionBlock,
} from "@/features/owner/verification-rules";
import {
  createMockVerificationService,
  verificationFromDemo,
} from "@/mocks/restaurant-verification";
import { initialData } from "@/mocks/fixtures";
import { ownerRestaurantSample } from "./fixtures/owner-restaurant";
import {
  verificationRequestSample as request,
  verificationSample,
} from "./fixtures/restaurant-verification";
import type { VerificationUpload } from "@/features/owner/restaurant-types";

afterEach(() => vi.useRealTimers());
const seed = {
  ...ownerRestaurantSample,
  verificationStatus: "unverified",
} as const;
const pdf = () =>
  new File(["%PDF-1.7 local test"], "license.pdf", { type: "application/pdf" });

describe("F-47 / OWN-06 verification", () => {
  it("builds only wire fields, trims input and omits empty optional values", () => {
    const upload: VerificationUpload = {
      key: "local-only",
      fileName: "license.pdf",
      docType: "business_license",
      media: {
        id: 9001,
        url: "private-url",
        purpose: "verification_doc",
        mimeType: "application/pdf",
        sizeBytes: 20,
        createdAt: "2026-10-01T00:00:00Z",
      },
    };
    expect(
      JSON.parse(
        JSON.stringify(
          buildVerificationRequest(
            {
              legalName: "  Pháp lý  ",
              businessLicenseNo: " GP-1 ",
              taxCode: "  ",
              ownerNote: "\n",
            },
            [upload],
          ),
        ),
      ),
    ).toEqual({
      legalName: "Pháp lý",
      businessLicenseNo: "GP-1",
      documents: [{ docType: "business_license", mediaId: 9001 }],
    });
    expect(validateVerificationRequest(request)).toEqual({});
  });
  it("enforces required legal fields and documented character boundaries", () => {
    expect(
      validateVerificationRequest({
        ...request,
        legalName: " ",
        businessLicenseNo: "\n",
        documents: [],
      }),
    ).toMatchObject({
      legalName: expect.any(String),
      businessLicenseNo: expect.any(String),
      documents: expect.any(String),
    });
    for (const [field, limit] of [
      ["legalName", 255],
      ["businessLicenseNo", 50],
      ["taxCode", 20],
      ["ownerNote", 1000],
    ] as const) {
      expect(
        validateVerificationRequest({ ...request, [field]: "x".repeat(limit) }),
      ).toEqual({});
      expect(
        validateVerificationRequest({
          ...request,
          [field]: "x".repeat(limit + 1),
        }),
      ).toHaveProperty(field);
    }
  });
  it("accepts all five types, requires a business license and does not invent a document count limit", () => {
    const documents = verificationDocumentTypes.map((item, index) => ({
      docType: item.value,
      mediaId: 9001 + index,
    }));
    expect(
      validateVerificationRequest({
        ...request,
        documents: [...documents, ...documents],
      }),
    ).toEqual({});
    expect(
      validateVerificationRequest({
        ...request,
        documents: documents.slice(1),
      }),
    ).toHaveProperty("documents");
    expect(
      validateVerificationRequest({
        ...request,
        documents: [{ docType: "business_license", mediaId: -1 }],
      })["documents[0].mediaId"],
    ).toBeTruthy();
    expect(
      validateVerificationRequest({
        ...request,
        documents: [{ docType: "business_license", mediaId: 1.5 }],
      })["documents[0].mediaId"],
    ).toBeTruthy();
  });
  it("validates MEDIA-01 MIME and per-format size limits without rejecting a 10 MB PDF", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]) {
      const max = (type === "application/pdf" ? 10 : 5) * 1024 * 1024;
      expect(validateVerificationFile({ type, size: max })).toBe("");
      expect(validateVerificationFile({ type, size: max + 1 })).toMatch(
        /vượt quá/,
      );
    }
    expect(
      validateVerificationFile({ type: "image/svg+xml", size: 100 }),
    ).toMatch(/Chỉ hỗ trợ/);
    expect(
      validateVerificationFile({ type: "application/pdf", size: 0 }),
    ).toMatch(/rỗng/);
  });
  it("mock media errors distinguish empty files, unsupported formats and oversized images", async () => {
    const service = createMockVerificationService(seed);
    await expect(
      service.upload(new File([], "empty.pdf", { type: "application/pdf" })),
    ).rejects.toMatchObject({ status: 400, errorCode: "VALIDATION_FAILED" });
    await expect(
      service.upload(new File(["svg"], "image.svg", { type: "image/svg+xml" })),
    ).rejects.toMatchObject({
      status: 400,
      errorCode: "UNSUPPORTED_MEDIA_TYPE",
    });
    await expect(
      service.upload(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.jpg", {
          type: "image/jpeg",
        }),
      ),
    ).rejects.toMatchObject({ status: 400, errorCode: "FILE_TOO_LARGE" });
  });
  it("maps indexed backend errors without losing document identity", () => {
    expect(
      verificationFieldErrors({
        LegalName: ["Tên sai"],
        "Documents[1].MediaId": ["Không thuộc sở hữu", "Tải lại"],
        "$.Documents[0].DocType": ["Sai loại"],
      }),
    ).toEqual({
      legalName: "Tên sai",
      "documents[1].mediaId": "Không thuộc sở hữu Tải lại",
      "documents[0].docType": "Sai loại",
    });
  });
  it("only allows initial submission for the backend's unverified state", () => {
    expect(verificationSubmissionBlock(seed)).toBe("");
    for (const status of ["pending", "verified", "rejected"] as const)
      expect(
        verificationSubmissionBlock({ verificationStatus: status }),
      ).not.toBe("");
  });
  it("mock uploads use verification_doc and atomically move only verification to pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T04:00:00Z"));
    const service = createMockVerificationService(seed);
    const media = await service.upload(pdf());
    expect(media).toMatchObject({
      id: 9001,
      purpose: "verification_doc",
      mimeType: "application/pdf",
      url: "",
    });
    const result = await service.submit(request);
    expect(result).toEqual({
      ...verificationSample,
      submittedAt: "2026-10-16T04:00:00.000Z",
      documents: [{ ...request.documents[0], url: "" }],
    });
    expect(await service.getOwnerRestaurant()).toEqual({
      ...seed,
      verificationStatus: "pending",
      latestVerification: result,
    });
    result.documents.length = 0;
    expect(
      (await service.getOwnerRestaurant()).latestVerification?.documents,
    ).toHaveLength(1);
    await expect(service.submit(request)).rejects.toMatchObject({
      status: 409,
      errorCode: "VERIFICATION_ALREADY_PENDING",
    });
    expect(seed.verificationStatus).toBe("unverified");
  });
  it("mock rejects unowned media, invalid input and absent restaurants", async () => {
    const service = createMockVerificationService(seed);
    await expect(service.submit(request)).rejects.toMatchObject({
      errorCode: "VALIDATION_FAILED",
      errors: { "Documents[0].MediaId": [expect.any(String)] },
    });
    expect((await service.getOwnerRestaurant()).verificationStatus).toBe(
      "unverified",
    );
    await expect(
      service.submit({ ...request, documents: [] }),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_FAILED" });
    const missing = createMockVerificationService(null);
    await expect(missing.getOwnerRestaurant()).rejects.toMatchObject({
      errorCode: "RESTAURANT_NOT_FOUND",
    });
    await expect(missing.submit(request)).rejects.toMatchObject({
      errorCode: "RESTAURANT_NOT_FOUND",
    });
  });
  it.each([
    ["verified", "RESTAURANT_ALREADY_VERIFIED"],
    ["pending", "VERIFICATION_ALREADY_PENDING"],
    ["rejected", "VERIFICATION_RESUBMIT_REQUIRED"],
  ] as const)(
    "mock retains %s state after a conflict",
    async (verificationStatus, errorCode) => {
      const service = createMockVerificationService({
        ...seed,
        verificationStatus,
      });
      await expect(service.submit(request)).rejects.toMatchObject({
        status: 409,
        errorCode,
      });
      expect((await service.getOwnerRestaurant()).verificationStatus).toBe(
        verificationStatus,
      );
    },
  );
  it("maps existing demo records and round-trips submitted numeric media IDs", () => {
    const record = initialData.submissions.find(
      (item) => item.kind === "verification",
    );
    expect(record).toBeDefined();
    if (!record) return;
    expect(
      verificationFromDemo({ ...record, status: "needs_changes" }, 8),
    ).toMatchObject({
      restaurantId: 8,
      status: "needs_more_info",
      documents: [{ docType: "business_license" }],
    });
    expect(
      verificationFromDemo(
        {
          ...record,
          id: "verification-22",
          documents: [
            { type: "id_card", name: "id.pdf", mediaId: 9003, url: "" },
          ],
        },
        9,
      ),
    ).toMatchObject({
      id: 22,
      restaurantId: 9,
      documents: [{ docType: "id_card", mediaId: 9003, url: "" }],
    });
  });
});
