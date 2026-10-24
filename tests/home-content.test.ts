import { describe, expect, it } from "vitest";
import {
  homeSelectionHref,
  readHomeSelection,
  selectHomeDishes,
} from "../src/features/discovery/home-content";

describe("public home editorial discovery", () => {
  it("matches Vietnamese accents, đ and separate words regardless of case", () => {
    expect(
      selectHomeDishes({ query: "  BUN   CHA ha noi ", taste: "all" }).map(
        (dish) => dish.id,
      ),
    ).toEqual(["bun-cha"]);
    expect(
      selectHomeDishes({ query: "ĐẬM ĐÀ", taste: "all" }).map(
        (dish) => dish.id,
      ),
    ).toEqual(["bun-cha", "thit-kho", "bun-thit-nuong", "com-tam"]);
    expect(
      selectHomeDishes({ query: "thanh nhe", taste: "all" }).map(
        (dish) => dish.id,
      ),
    ).toEqual(["goi-cuon"]);
  });
  it("combines taste and search, including no matches", () => {
    expect(selectHomeDishes({ query: "pho", taste: "fresh" })).toEqual([]);
    expect(selectHomeDishes({ query: "", taste: "rich" })).toHaveLength(4);
    expect(selectHomeDishes({ query: "", taste: "all" })).toHaveLength(8);
    expect(
      selectHomeDishes({ query: "banh cuon", taste: "warm" }).map(
        (dish) => dish.id,
      ),
    ).toEqual(["banh-cuon"]);
  });
  it("bounds untrusted URL input and ignores ambiguous or unsupported filters", () => {
    expect(readHomeSelection({ q: ["pho", "cuon"], taste: "invalid" })).toEqual(
      { query: "", taste: "all" },
    );
    expect(readHomeSelection({ q: "   phở   ", taste: "warm" })).toEqual({
      query: "phở",
      taste: "warm",
    });
    expect(
      readHomeSelection({ q: "x".repeat(200), taste: ["fresh", "rich"] }),
    ).toEqual({ query: "x".repeat(120), taste: "all" });
  });
  it("round trips search and taste in shareable, encoded same-origin URLs", () => {
    const selection = { query: "phở & bún # ngon", taste: "rich" } as const;
    const url = new URL(homeSelectionHref(selection), "http://localhost");
    expect(url.pathname).toBe("/");
    expect(url.hash).toBe("#mon-ngon");
    expect(readHomeSelection(Object.fromEntries(url.searchParams))).toEqual(
      selection,
    );
    expect(homeSelectionHref({ query: "", taste: "all" })).toBe("/#mon-ngon");
  });
});
