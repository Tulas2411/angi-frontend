import { describe, expect, it } from "vitest";
import {
  dishAt,
  menuPrice,
  platesBetween,
  snapTurn,
  stepsTo,
  turnDuration,
  wheelCounter,
} from "@/features/explore/menu-wheel-rules";

describe("menu wheel", () => {
  it("puts dish k mod n on every plate of the endless wheel", () => {
    expect(dishAt(0, 6)).toBe(0);
    expect(dishAt(7, 6)).toBe(1);
    expect(dishAt(-1, 6)).toBe(5);
    expect(dishAt(3, 0)).toBe(0);
  });

  it("turns the shortest way to a chosen dish, forward on a tie", () => {
    expect(stepsTo(0, 1, 6)).toBe(1);
    expect(stepsTo(0, 5, 6)).toBe(-1);
    expect(stepsTo(0, 3, 6)).toBe(3);
    expect(stepsTo(8, 2, 6)).toBe(0);
    expect(stepsTo(-1, 0, 6)).toBe(1);
    expect(stepsTo(4, 0, 1)).toBe(0);
  });

  it("draws the travelled arc and one plate on each side", () => {
    expect(platesBetween(2, 2)).toEqual([1, 2, 3]);
    expect(platesBetween(2, 4)).toEqual([1, 2, 3, 4, 5]);
    expect(platesBetween(0, -2)).toEqual([-3, -2, -1, 0, 1]);
  });

  it("takes 650 ms for one step and never more than 900 ms", () => {
    expect(turnDuration(0)).toBe(0);
    expect(turnDuration(1)).toBe(650);
    expect(turnDuration(-2)).toBe(770);
    expect(turnDuration(9)).toBe(900);
  });

  it("snaps a drag to the nearest plate, one further on a quick flick", () => {
    expect(snapTurn(2.3, 0)).toBe(2);
    expect(snapTurn(2.3, 3)).toBe(3);
    expect(snapTurn(2.6, -3)).toBe(2);
    expect(snapTurn(-0.4, 0)).toBe(0);
  });

  it("words the counter and the price like a printed menu", () => {
    expect(wheelCounter(2, 6)).toBe("03 / 06");
    expect(wheelCounter(11, 12)).toBe("12 / 12");
    expect(menuPrice(169000)).toBe("169.000đ");
  });
});
