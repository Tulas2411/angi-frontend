import { describe, expect, it } from "vitest";
import { cutDescription } from "@/features/explore/description-cut";

/** A card that holds `perLine` words a line; "…" costs one word of room. */
const card =
  (perLine: number) => (count: number, lines: number, ellipsis: boolean) =>
    count + (ellipsis ? 1 : 0) <= perLine * lines;

describe("description cut", () => {
  it("keeps two lines and seven words of the third, then cuts", () => {
    // 10 words a line: two lines hold 20, the cut falls after word 27.
    expect(cutDescription(60, card(10))).toBe(27);
  });

  it("shows a text whole when it ends within that budget", () => {
    expect(cutDescription(12, card(10))).toBeNull();
    expect(cutDescription(27, card(10))).toBeNull();
  });

  it("cuts earlier when the third line has no room left for the ellipsis", () => {
    // 8 words a line: 16 on two lines, 23 would be the budget but three lines hold 24 with "…".
    expect(cutDescription(40, card(8))).toBe(23);
    // 4 words a line: the third line takes only 3 words before "…".
    expect(cutDescription(40, card(4))).toBe(11);
  });

  it("returns nothing to cut for an empty text", () => {
    expect(cutDescription(0, card(10))).toBeNull();
  });
});
