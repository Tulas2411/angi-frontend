import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearHomeRoadmapDraft,
  emptyHomeRoadmap,
  homeRoadmapDraftKey,
  homeRoadmapRequest,
  parseHomeRoadmapDraft,
  readHomeRoadmapDraft,
  saveHomeRoadmapDraft,
  validateHomeRoadmap,
} from "@/features/discovery/home-roadmap-rules";

const values = {
  province: "Thành phố Đà Nẵng",
  startDate: "2026-11-06",
  numDays: "3",
};
afterEach(() => vi.unstubAllGlobals());
describe("homepage roadmap creation", () => {
  it("requires exactly the three inputs without asking for another title or budget", () => {
    expect(validateHomeRoadmap(emptyHomeRoadmap)).toMatchObject({
      province: expect.any(String),
      startDate: expect.any(String),
    });
    expect(validateHomeRoadmap(values)).toEqual({});
  });
  it("uses the planner's 1–7 day app rule and validates real calendar dates", () => {
    for (const numDays of ["", "0", "8", "1.5", "NaN"])
      expect(validateHomeRoadmap({ ...values, numDays }).numDays).toBeTruthy();
    for (const numDays of ["1", "7"])
      expect(validateHomeRoadmap({ ...values, numDays })).toEqual({});
    expect(
      validateHomeRoadmap({ ...values, startDate: "2026-02-29" }).startDate,
    ).toBeTruthy();
    expect(validateHomeRoadmap({ ...values, startDate: "2028-02-29" })).toEqual(
      {},
    );
  });
  it("keeps the existing contract: province suggests the title, not an invented wire field", () => {
    expect(homeRoadmapRequest(values)).toEqual({
      title: "3 ngày ăn ngon Đà Nẵng",
      startDate: "2026-11-06",
      numDays: 3,
      originMode: "none",
    });
    expect(values.province).toBe("Thành phố Đà Nẵng");
    expect(
      validateHomeRoadmap({ ...values, province: "a".repeat(101) }).province,
    ).toBeTruthy();
  });
  it("restores only validated form fields and discards malformed or partial drafts", () => {
    expect(
      parseHomeRoadmapDraft(
        JSON.stringify({ ...values, unrelated: "ignored" }),
      ),
    ).toEqual(values);
    for (const raw of [
      "",
      "invalid JSON",
      "null",
      "[]",
      '{"province":true}',
      JSON.stringify({ ...values, numDays: "31" }),
    ])
      expect(parseHomeRoadmapDraft(raw)).toBeNull();
  });
  it("stores a non-secret draft only for the current tab and clears it after creation", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    expect(saveHomeRoadmapDraft(values)).toBe(true);
    expect(readHomeRoadmapDraft()).toBe(JSON.stringify(values));
    expect([...storage.keys()]).toEqual([homeRoadmapDraftKey]);
    clearHomeRoadmapDraft();
    expect(readHomeRoadmapDraft()).toBe("");
  });
  it("handles blocked browser storage without claiming that the guest draft was saved", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    });
    expect(saveHomeRoadmapDraft(values)).toBe(false);
    expect(readHomeRoadmapDraft()).toBe("");
    expect(() => clearHomeRoadmapDraft()).not.toThrow();
  });
});
