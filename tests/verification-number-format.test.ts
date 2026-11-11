import { describe, expect, it } from "vitest";
import {
  buildVerificationRequest,
  cleanBusinessLicense,
  cleanTaxCode,
  validateVerificationRequest,
} from "@/features/owner/verification-rules";
import { verificationRequestSample as request } from "./fixtures/restaurant-verification";

describe("business license and tax code formats", () => {
  it("accepts a 10-digit enterprise code or a household business code", () => {
    for (const value of ["0101234567", "01A8012345", "32A80123456"])
      expect(
        validateVerificationRequest({ ...request, businessLicenseNo: value }),
        value,
      ).toEqual({});
    for (const value of [
      "123456789",
      "01234567890",
      "GP-1",
      "0A12345678",
      "01AB123456",
      "01A123456",
    ])
      expect(
        validateVerificationRequest({ ...request, businessLicenseNo: value }),
        value,
      ).toHaveProperty("businessLicenseNo");
  });

  it("accepts a 10-digit tax code or a branch 10-3 code, and leaves it optional", () => {
    for (const value of ["0101234567", "0101234567-001", undefined])
      expect(
        validateVerificationRequest({ ...request, taxCode: value }),
        String(value),
      ).toEqual({});
    for (const value of ["010123456", "01012345678", "0101234567-01", "abc"])
      expect(
        validateVerificationRequest({ ...request, taxCode: value }),
        value,
      ).toHaveProperty("taxCode");
  });

  it("cleans what is typed: upper case, no spaces or symbols, bounded length", () => {
    expect(cleanBusinessLicense(" 01a-80 12345 ")).toBe("01A8012345");
    expect(cleanBusinessLicense("01A801234567890")).toHaveLength(11);
    expect(cleanTaxCode("0101 234 567-001x")).toBe("0101234567-001");
    expect(cleanTaxCode("0101234567-0011234")).toHaveLength(14);
    expect(
      buildVerificationRequest(
        {
          legalName: "Hộ kinh doanh",
          businessLicenseNo: "01a8012345",
          taxCode: " 0101234567 ",
          ownerNote: "",
        },
        [],
      ),
    ).toMatchObject({ businessLicenseNo: "01A8012345", taxCode: "0101234567" });
  });
});
