import { describe, expect, it } from "vitest";
import { dateLabel, money, pageSlice, validateUpload } from "@/shared/format";

describe("shared formatting and upload rules", () => {
  it("enforces separate image and document size/type limits", () => {
    expect(
      validateUpload({ type: "image/png", size: 5 * 1024 * 1024 }),
    ).toBeNull();
    expect(
      validateUpload({ type: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ).toBeTruthy();
    expect(
      validateUpload({ type: "application/pdf", size: 10 * 1024 * 1024 }, true),
    ).toBeNull();
    expect(
      validateUpload(
        { type: "application/pdf", size: 10 * 1024 * 1024 + 1 },
        true,
      ),
    ).toBeTruthy();
    expect(validateUpload({ type: "application/pdf", size: 1 })).toBeTruthy();
    expect(validateUpload({ type: "image/svg+xml", size: 1 })).toBeTruthy();
  });
  it("keeps page bounds, totals and empty results consistent", () => {
    expect(pageSlice([1, 2, 3, 4, 5, 6], 999, 5)).toMatchObject({
      items: [6],
      page: 2,
      total: 6,
      first: 6,
      last: 6,
      pages: 2,
    });
    expect(pageSlice([], 3)).toMatchObject({
      items: [],
      first: 0,
      last: 0,
      page: 1,
    });
  });
  it("formats VND as an integer amount and keeps date-only values on the Vietnam calendar day", () => {
    expect(money(55000).replace(/\s/g, " ")).toMatch(/^55\.000\s?₫$/);
    expect(dateLabel("2026-10-10")).toContain("10");
    // 17:30 UTC is already the next day in Vietnam (UTC+7).
    expect(dateLabel("2026-10-10T17:30:00Z")).toContain("11");
  });
});
