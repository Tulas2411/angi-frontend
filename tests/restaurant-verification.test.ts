import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVerificationRequest,
  validateVerificationFile,
  validateVerificationRequest,
  verificationDocumentTypes,
  verificationFieldErrors,
  verificationSubmissionBlock,
} from "@/features/owner/verification-rules";
import { ownerRestaurantSample } from "./fixtures/owner-restaurant";
import { verificationRequestSample as request } from "./fixtures/restaurant-verification";
import type { VerificationUpload } from "@/features/owner/restaurant-types";

afterEach(() => vi.useRealTimers());
const seed = {
  ...ownerRestaurantSample,
  verificationStatus: "unverified",
} as const;

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
});
