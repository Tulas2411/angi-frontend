import { describe, expect, it } from "vitest";
import { homeDishes } from "../src/features/discovery/home-content";
import { createDishPhotos } from "../src/features/discovery/home-dish-layout";

describe("editorial dish scatter", () => {
  it("keeps every dish exactly once without mutating the source", () => {
    const before = [...homeDishes];
    const photos = createDishPhotos(homeDishes, () => 0);
    expect(photos.map(({ dish }) => dish.id).sort()).toEqual(
      homeDishes.map((dish) => dish.id).sort(),
    );
    expect(photos.map(({ dish }) => dish.id)).not.toEqual(
      homeDishes.map((dish) => dish.id),
    );
    expect(homeDishes).toEqual(before);
  });
  it("keeps varied sizes and rotation bounded with distinct depth for all eight photos", () => {
    for (const value of [0, 0.5, 0.999999]) {
      const photos = createDishPhotos(homeDishes, () => value);
      expect(new Set(photos.map((photo) => photo.layer)).size).toBe(8);
      expect(photos.every(({ size }) => size >= 0.78 && size <= 1.08)).toBe(
        true,
      );
      const sizes = photos.map(({ size }) => size);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(0.25);
      expect(
        photos.every(
          (photo) => Number.isFinite(photo.angle) && Math.abs(photo.angle) <= 8,
        ),
      ).toBe(true);
    }
  });
  it("does not restore filtered-out dishes, including empty and single results", () => {
    expect(createDishPhotos([])).toEqual([]);
    expect(
      createDishPhotos([homeDishes[0]], () => 0.5).map(({ dish }) => dish.id),
    ).toEqual(["pho-bo"]);
    expect(createDishPhotos([homeDishes[0]], () => 0.5)[0].layer).toBe(8);
    expect(createDishPhotos([homeDishes[0]], () => 0.5)[0].size).toBe(1);
    expect(createDishPhotos(homeDishes.slice(0, 2), () => 0)).toHaveLength(2);
  });
});
