import { describe, expect, it } from "vitest";
import {
  businessHourFieldErrors,
  isOpenAt,
  sortBusinessHours,
  validateBusinessHours,
} from "@/features/owner/business-hours-rules";
import { createMockBusinessHoursService } from "@/mocks/business-hours";
import { ownerProfileFromDemo } from "@/mocks/restaurant-profile";
import { initialData } from "@/mocks/fixtures";
import { ownerRestaurantSample } from "./fixtures/owner-restaurant";
import type { BusinessHourDto } from "@/features/owner/restaurant-types";

const hour = (
  dayOfWeek: number,
  openTime: string,
  closeTime: string,
): BusinessHourDto => ({ dayOfWeek, openTime, closeTime });
describe("OWN-04 weekly hours", () => {
  it("accepts multiple intervals, empty schedules and overnight hours with touching boundaries", () => {
    for (const hours of [
      [],
      [hour(0, "00:00", "23:59")],
      [hour(1, "06:00", "13:30"), hour(1, "13:30", "21:00")],
      [hour(1, "22:00", "02:00"), hour(2, "02:00", "05:00")],
    ]) {
      expect(validateBusinessHours(hours)).toEqual({
        errors: {},
        errorCode: null,
      });
    }
  });
  it.each([
    [hour(1, "06:00", "13:30"), hour(1, "13:00", "17:00")],
    [hour(1, "22:00", "02:00"), hour(2, "01:00", "05:00")],
    [hour(6, "22:00", "03:00"), hour(0, "02:00", "08:00")],
    [hour(0, "22:00", "03:00"), hour(1, "02:00", "08:00")],
    [hour(1, "06:00", "13:30"), hour(1, "06:00", "13:30")],
  ])("rejects real overlaps including the circular week: %o / %o", (a, b) => {
    const result = validateBusinessHours([a, b]);
    expect(result.errorCode).toBe("INVALID_BUSINESS_HOURS");
    expect(result.errors).toHaveProperty("hours[0].openTime");
    expect(result.errors).toHaveProperty("hours[1].openTime");
  });
  it("rejects malformed times, equal endpoints and invalid days without inventing a same-day close rule", () => {
    for (const hours of [
      [hour(-1, "06:00", "13:30")],
      [hour(7, "06:00", "13:30")],
      [hour(1.5, "06:00", "13:30")],
      [hour(1, "6:00", "13:30")],
      [hour(1, "24:00", "13:30")],
      [hour(1, "", "13:30")],
      [hour(1, "06:00", "")],
      [hour(1, "06:60", "13:30")],
      [hour(1, "06:00:01", "13:30")],
      [hour(1, "06:00", "06:00")],
    ])
      expect(validateBusinessHours(hours).errorCode).toBe("VALIDATION_FAILED");
    expect(
      validateBusinessHours([hour(1, "22:00", "02:00")]).errorCode,
    ).toBeNull();
  });
  it("computes the mock schedule in Vietnam time with inclusive opens and exclusive closes", () => {
    const hours = [hour(1, "06:00", "13:30"), hour(6, "22:00", "03:00")];
    expect(isOpenAt(hours, new Date("2026-10-11T23:00:00Z"))).toBe(true);
    expect(isOpenAt(hours, new Date("2026-10-12T06:30:00Z"))).toBe(false);
    expect(isOpenAt(hours, new Date("2026-10-10T19:00:00Z"))).toBe(true);
    expect(isOpenAt(hours, new Date("2026-10-10T20:00:00Z"))).toBe(false);
    expect(isOpenAt([], new Date("2026-10-12T03:00:00Z"))).toBe(false);
  });
  it("returns the workbook response shape, replaces rather than merges and preserves profile/status data", async () => {
    const service = createMockBusinessHoursService(
      ownerRestaurantSample,
      () => new Date("2026-10-12T03:00:00Z"),
    );
    const hours = [hour(1, "06:00", "13:30")];
    expect(await service.updateHours({ hours })).toEqual({
      hours,
      isOpenNow: true,
    });
    const before = await service.getOwnerRestaurant();
    const response = await service.updateHours({
      hours: [hour(6, "22:00", "02:00"), hour(0, "06:00", "10:00")],
    });
    expect(response.hours.map((entry) => entry.dayOfWeek)).toEqual([0, 6]);
    expect(response.isOpenNow).toBe(false);
    expect(await service.getOwnerRestaurant()).toEqual({
      ...before,
      businessHours: response.hours,
      isOpenNow: false,
    });
    expect(await service.updateHours({ hours: [] })).toEqual({
      hours: [],
      isOpenNow: false,
    });
    expect((await service.getOwnerRestaurant()).businessHours).toEqual([]);
  });
  it("keeps the previous schedule after errors and isolates returned/request arrays", async () => {
    const service = createMockBusinessHoursService(ownerRestaurantSample);
    const before = await service.getOwnerRestaurant();
    await expect(
      service.updateHours({ hours: [hour(1, "06:00", "06:00")] }),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_FAILED" });
    await expect(
      service.updateHours({
        hours: [hour(1, "06:00", "13:30"), hour(1, "07:00", "10:00")],
      }),
    ).rejects.toMatchObject({
      errorCode: "INVALID_BUSINESS_HOURS",
      errors: undefined,
    });
    expect(await service.getOwnerRestaurant()).toEqual(before);
    const request = { hours: [hour(1, "06:00", "13:30")] };
    const result = await service.updateHours(request);
    request.hours[0].openTime = "10:00";
    result.hours.length = 0;
    expect((await service.getOwnerRestaurant()).businessHours).toEqual([
      hour(1, "06:00", "13:30"),
    ]);
  });
  it("retains every demo interval including an explicit empty list during profile reload", () => {
    const current = initialData.restaurants[0];
    const hours = [hour(1, "06:00", "13:30"), hour(1, "17:00", "22:00")];
    expect(
      ownerProfileFromDemo(
        { ...current, businessHours: hours },
        initialData.hours,
      ).businessHours,
    ).toEqual(hours);
    expect(
      ownerProfileFromDemo({ ...current, businessHours: [] }, initialData.hours)
        .businessHours,
    ).toEqual([]);
    const sorted = sortBusinessHours([hours[1], hours[0]]);
    expect(sorted).toEqual(hours);
    expect(hours[0].openTime).toBe("06:00");
  });
  it("maps indexed backend field errors and keeps the missing-owner state explicit", async () => {
    expect(
      businessHourFieldErrors({
        "Hours[2].CloseTime": ["Giờ đóng không hợp lệ"],
        hours: ["Danh sách không hợp lệ"],
      }),
    ).toEqual({
      "hours[2].closeTime": "Giờ đóng không hợp lệ",
      hours: "Danh sách không hợp lệ",
    });
    const service = createMockBusinessHoursService(null);
    await expect(service.getOwnerRestaurant()).rejects.toMatchObject({
      errorCode: "RESTAURANT_NOT_FOUND",
    });
    await expect(service.updateHours({ hours: [] })).rejects.toMatchObject({
      errorCode: "RESTAURANT_NOT_FOUND",
    });
  });
});
