import { describe, expect, it } from "vitest";
import {
  businessHourFieldErrors,
  isOpenAt,
  sortBusinessHours,
  validateBusinessHours,
} from "@/features/owner/business-hours-rules";
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
  it("sorts a copy by day then opening time", () => {
    const input = [
      hour(2, "09:00", "10:00"),
      hour(1, "13:00", "14:00"),
      hour(1, "06:00", "07:00"),
    ];
    const original = structuredClone(input);
    expect(
      sortBusinessHours(input).map((h) => [h.dayOfWeek, h.openTime]),
    ).toEqual([
      [1, "06:00"],
      [1, "13:00"],
      [2, "09:00"],
    ]);
    expect(input).toEqual(original);
  });
  it("maps PascalCase backend errors onto form field keys", () => {
    expect(
      businessHourFieldErrors({
        "Hours[0].OpenTime": ["Sai giờ", "Thử lại"],
        "Hours[1].CloseTime": ["Sai giờ đóng"],
        "Hours[2].DayOfWeek": ["Sai ngày"],
      }),
    ).toEqual({
      "hours[0].openTime": "Sai giờ Thử lại",
      "hours[1].closeTime": "Sai giờ đóng",
      "hours[2].dayOfWeek": "Sai ngày",
    });
    expect(businessHourFieldErrors(undefined)).toEqual({});
  });
  it("evaluates openness at UTC+7, including overnight and week-wrap intervals", () => {
    // 2026-10-05 is a Monday; 03:00Z is 10:00 in Vietnam.
    const monday10 = new Date("2026-10-05T03:00:00Z");
    expect(isOpenAt([hour(1, "09:00", "11:00")], monday10)).toBe(true);
    expect(
      isOpenAt([hour(1, "10:00", "11:00")], new Date("2026-10-05T02:59:00Z")),
    ).toBe(false);
    expect(isOpenAt([hour(1, "09:00", "10:00")], monday10)).toBe(false);
    // Saturday 22:00-03:00 stays open on Sunday 01:00 (Sunday = 0).
    expect(
      isOpenAt([hour(6, "22:00", "03:00")], new Date("2026-10-10T18:00:00Z")),
    ).toBe(true);
    expect(
      isOpenAt([hour(6, "22:00", "03:00")], new Date("2026-10-11T00:00:00Z")),
    ).toBe(false);
    // Sunday 22:00-03:00 wraps into Monday.
    expect(
      isOpenAt([hour(0, "22:00", "03:00")], new Date("2026-10-11T19:00:00Z")),
    ).toBe(true);
    expect(isOpenAt([], monday10)).toBe(false);
  });
});
