import { describe, expect, it } from "vitest";
import { clampedMonth, shiftMonth } from "@/components/ui/date-time-fields";

const day = (iso: string) => new Date(`${iso}T00:00:00`);
const label = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

describe("calendar wheel months", () => {
  it("moves to the first day of the next or previous month, across years", () => {
    expect(label(shiftMonth(day("2026-11-30"), 1))).toBe("2026-12");
    expect(label(shiftMonth(day("2026-12-15"), 1))).toBe("2027-1");
    expect(label(shiftMonth(day("2026-01-31"), -1))).toBe("2025-12");
    expect(shiftMonth(day("2026-11-30"), 0).getDate()).toBe(1);
  });

  it("never turns before the month of min nor after the month of max", () => {
    const min = day("2026-11-09");
    const max = day("2027-02-10");
    const november = shiftMonth(min, 0);
    expect(clampedMonth(november, -1, min, max)).toBe(november);
    expect(label(clampedMonth(november, 1, min, max))).toBe("2026-12");
    const february = day("2027-02-01");
    expect(clampedMonth(february, 1, min, max)).toBe(february);
    expect(label(clampedMonth(february, -1, min, max))).toBe("2027-1");
    expect(label(clampedMonth(november, -5))).toBe("2026-6");
  });
});
