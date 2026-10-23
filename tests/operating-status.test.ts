import { describe, expect, it } from "vitest";
import {
  buildOperatingStatusRequest,
  isOperatingStatus,
  operatingStatusFieldErrors,
  operatingStatuses,
  validateOperatingStatus,
} from "@/features/owner/operating-status-rules";
import { createMockOperatingStatusService } from "@/mocks/operating-status";
import { ownerProfileFromDemo } from "@/mocks/restaurant-profile";
import { profileToDemoView } from "@/features/owner/profile-rules";
import { initialData } from "@/mocks/fixtures";
import { ownerRestaurantSample as original } from "./fixtures/owner-restaurant";

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
  it("returns only the documented response and preserves profile, hours and other statuses", async () => {
    const service = createMockOperatingStatusService(original);
    expect(
      await service.updateStatus({
        operatingStatus: "temporarily_closed",
        note: "Nghỉ Tết",
      }),
    ).toEqual({ operatingStatus: "temporarily_closed" });
    const stored = await service.getOwnerRestaurant();
    expect(stored).toEqual({
      ...original,
      operatingStatus: "temporarily_closed",
    });
    expect(stored).not.toHaveProperty("note");
    expect(original.operatingStatus).toBe("open");
    stored.images.push("outside mutation");
    expect((await service.getOwnerRestaurant()).images).toEqual(
      original.images,
    );
  });
  it("supports permanent closure and reopening when moderation allows it", async () => {
    const service = createMockOperatingStatusService(original);
    for (const status of [
      "permanently_closed",
      "temporarily_closed",
      "open",
    ] as const) {
      expect(await service.updateStatus({ operatingStatus: status })).toEqual({
        operatingStatus: status,
      });
    }
  });
  it("blocks reopening a suspended restaurant and retains the previous state", async () => {
    const seed = {
      ...original,
      operatingStatus: "temporarily_closed",
      moderationStatus: "suspended",
    } as const;
    const service = createMockOperatingStatusService(seed);
    await expect(
      service.updateStatus({ operatingStatus: "open", note: "Mở lại" }),
    ).rejects.toMatchObject({ status: 409, errorCode: "RESTAURANT_SUSPENDED" });
    expect(await service.getOwnerRestaurant()).toEqual(seed);
    expect(
      await service.updateStatus({ operatingStatus: "permanently_closed" }),
    ).toEqual({ operatingStatus: "permanently_closed" });
  });
  it("allows suspended restaurants to close or keep an unchanged open status", async () => {
    const service = createMockOperatingStatusService({
      ...original,
      moderationStatus: "suspended",
    });
    expect(await service.updateStatus({ operatingStatus: "open" })).toEqual({
      operatingStatus: "open",
    });
    expect(
      await service.updateStatus({ operatingStatus: "temporarily_closed" }),
    ).toEqual({ operatingStatus: "temporarily_closed" });
  });
  it("leaves a same-status request unchanged, including a note that has no transition", async () => {
    const service = createMockOperatingStatusService(original);
    await service.updateStatus({
      operatingStatus: "open",
      note: "Ghi chú không đổi trạng thái",
    });
    expect(await service.getOwnerRestaurant()).toEqual(original);
  });
  it("rejects invalid notes before mutation and keeps missing owners explicit", async () => {
    const service = createMockOperatingStatusService(original);
    await expect(
      service.updateStatus({
        operatingStatus: "temporarily_closed",
        note: "x".repeat(501),
      }),
    ).rejects.toMatchObject({
      status: 400,
      errorCode: "VALIDATION_FAILED",
      errors: { note: expect.any(Array) },
    });
    expect(await service.getOwnerRestaurant()).toEqual(original);
    const missing = createMockOperatingStatusService(null);
    await expect(missing.getOwnerRestaurant()).rejects.toMatchObject({
      errorCode: "RESTAURANT_NOT_FOUND",
    });
    await expect(
      missing.updateStatus({ operatingStatus: "open" }),
    ).rejects.toMatchObject({ errorCode: "RESTAURANT_NOT_FOUND" });
  });
  it("keeps exact demo closure states through profile mapping and handles legacy fixtures", () => {
    const fixture = initialData.restaurants[0];
    for (const status of operatingStatuses) {
      const view = { ...fixture, operating: status };
      const wire = ownerProfileFromDemo(view, initialData.hours);
      expect(wire.operatingStatus).toBe(status);
      expect(
        profileToDemoView(view, { ...wire, name: "Đổi tên" }).operating,
      ).toBe(status);
    }
    expect(
      ownerProfileFromDemo(
        { ...fixture, operating: "closed" },
        initialData.hours,
      ).operatingStatus,
    ).toBe("temporarily_closed");
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
