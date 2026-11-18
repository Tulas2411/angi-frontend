import { describe, expect, it } from "vitest";
import {
  applyVndEdit,
  formatVndInput,
  vndDigitsFromPaste,
} from "@/shared/money/vnd-input";

/** Money text inputs (roadmap budget, dish price): what a paste and the digit limit keep. */
describe("VND input", () => {
  it("reads a pasted amount as Vietnamese đồng: dots and commas group thousands", () => {
    expect(vndDigitsFromPaste("45.000")).toBe("45000");
    expect(vndDigitsFromPaste("45,000")).toBe("45000");
    expect(vndDigitsFromPaste(" 1.500.000 VND ")).toBe("1500000");
    expect(vndDigitsFromPaste("45.000đ")).toBe("45000");
    expect(vndDigitsFromPaste("45.000 ₫")).toBe("45000");
    expect(vndDigitsFromPaste("45000")).toBe("45000");
  });

  it("drops a fraction of a đồng and ignores text without digits", () => {
    expect(vndDigitsFromPaste("45.000,00")).toBe("45000");
    expect(vndDigitsFromPaste("1,500,000.50")).toBe("1500000");
    expect(vndDigitsFromPaste("giá")).toBe("");
  });

  it("keeps at most the requested number of digits and formats them", () => {
    expect(applyVndEdit("", "1".repeat(20), 20, false, 12).digits).toHaveLength(
      12,
    );
    expect(applyVndEdit("", "1".repeat(20), 20, false).digits).toHaveLength(14);
    expect(formatVndInput("45000")).toBe("45.000 VND");
  });
});
