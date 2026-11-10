import { describe, expect, it } from "vitest";
import {
  clampRange,
  hourPresets,
  rangeOnTrack,
  toMinutes,
  toTime,
  trackEnd,
} from "@/features/owner/hours-range-slider";

describe("business hours slider", () => {
  it("places a closing time after midnight on the next-day part of the track", () => {
    expect(rangeOnTrack("06:00", "22:00")).toEqual({ open: 360, close: 1320 });
    expect(rangeOnTrack("18:00", "02:00")).toEqual({ open: 1080, close: 1560 });
    expect(rangeOnTrack("22:00", "00:00")).toEqual({ open: 1320, close: 1440 });
    expect(rangeOnTrack("", "22:00")).toBeNull();
  });

  it("turns track positions back into HH:mm, wrapping past midnight", () => {
    expect(toTime(1320)).toBe("22:00");
    expect(toTime(1560)).toBe("02:00");
    expect(toTime(1440)).toBe("00:00");
    expect(toMinutes("07:45")).toBe(465);
    expect(toMinutes("7:45")).toBeNull();
  });

  it("keeps the handles apart, the opening in the day and the range under 24 hours", () => {
    expect(clampRange(1000, 900, "open")).toEqual({ open: 1000, close: 1015 });
    expect(clampRange(600, 590, "close")).toEqual({ open: 600, close: 615 });
    expect(clampRange(1500, 1600, "open").open).toBe(1425);
    expect(clampRange(60, trackEnd, "close")).toEqual({
      open: 60,
      close: 1485,
    });
    expect(clampRange(600, 5000, "close").close).toBe(trackEnd);
  });

  it("offers valid presets (different times, at most one overnight)", () => {
    for (const preset of hourPresets) {
      expect(preset.open).not.toBe(preset.close);
      expect(rangeOnTrack(preset.open, preset.close)).not.toBeNull();
    }
  });
});
