import { describe, expect, it } from "vitest";
import {
  buildOperatingStatusRequest,
  isOperatingStatus,
  operatingStatusFieldErrors,
  operatingStatuses,
  validateOperatingStatus,
} from "@/features/owner/operating-status-rules";

describe("OWN-05 operating status", () => {
  it("accepts exactly the documented statuses and the 500-character note boundary", () => {
    for (const status of operatingStatuses) {
      expect(isOperatingStatus(status)).toBe(true);
      expect(validateOperatingStatus(status, "x".repeat(500))).toEqual({});
    }
    for (const status of ["", "closed", "OPEN", " open "])
      expect(validateOperatingStatus(status, "")).toHaveProperty(
        "operatingStatus",
      );
    expect(validateOperatingStatus("open", "x".repeat(501))).toHaveProperty(
      "note",
    );
  });
  it("builds the workbook request without unrelated fields or empty reasons", () => {
    expect(
      buildOperatingStatusRequest("temporarily_closed", "  Nghỉ Tết  "),
    ).toEqual({ operatingStatus: "temporarily_closed", note: "Nghỉ Tết" });
    expect(buildOperatingStatusRequest("open", " \n ")).toEqual({
      operatingStatus: "open",
    });
  });
  it("maps backend error keys without losing unrelated structured messages", () => {
    expect(
      operatingStatusFieldErrors({
        OperatingStatus: ["Trạng thái không hợp lệ"],
        Note: ["Lý do quá dài"],
        other: ["Thông tin khác"],
      }),
    ).toEqual({
      operatingStatus: "Trạng thái không hợp lệ",
      note: "Lý do quá dài",
      other: "Thông tin khác",
    });
  });
});
