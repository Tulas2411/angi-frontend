import { describe, expect, it } from "vitest";
import {
  brakeDuration,
  cruiseDuration,
  cruiseSpeed,
  cruiseTravel,
  markerOffset,
  maxTravel,
  planSpin,
  reelLength,
  restingTravel,
  spinDuration,
  spinSpeed,
  spinTravel,
} from "@/features/roll/roll-spin-rules";

/** The strip's layout on a 947px track with 250px cards and a 16px gap. */
const geometry = {
  trackWidth: 947,
  cardWidth: 250,
  step: 266,
  base: 16,
};

/** The spin that ends on the third dish of a cycle of four. */
const plan = planSpin(geometry, 2, 4);

describe("roll spin", () => {
  it("turns fast first and then brakes to a full stop", () => {
    // The fast phase never stands still: the travel keeps growing.
    expect(cruiseTravel(0)).toBe(0);
    // The wind-up costs a little ground, but the reel is already at the cruise speed.
    expect(cruiseTravel(1000)).toBeGreaterThan(cruiseSpeed * 0.9);
    expect(cruiseTravel(cruiseDuration)).toBeGreaterThan(
      (cruiseSpeed * cruiseDuration) / 1000 - 500,
    );
    // The reel keeps turning while it waits for the answer.
    expect(cruiseTravel(cruiseDuration * 3)).toBeGreaterThan(
      cruiseTravel(cruiseDuration),
    );
  });

  it("keeps the speed continuous at every boundary", () => {
    // The wind-up starts from a standstill and reaches the cruise speed.
    expect(spinSpeed(plan, 0)).toBe(0);
    expect(spinSpeed(plan, 200)).toBeCloseTo(cruiseSpeed, 0);
    // The brake starts at exactly the cruise speed: no jump of speed.
    expect(spinSpeed(plan, plan.cruiseEnd)).toBeCloseTo(cruiseSpeed, 0);
    expect(
      spinSpeed(plan, plan.cruiseEnd - 1) - spinSpeed(plan, plan.cruiseEnd),
    ).toBeLessThan(cruiseSpeed * 0.05);
    // The brake ends at a full stop.
    expect(spinSpeed(plan, plan.cruiseEnd + plan.brake)).toBeCloseTo(0, 0);
  });

  it("never speeds up while it brakes", () => {
    const speeds = [0, 0.25, 0.5, 0.75, 0.99, 1].map((u) =>
      spinSpeed(plan, plan.cruiseEnd + u * plan.brake),
    );
    for (let index = 1; index < speeds.length; index += 1)
      expect(speeds[index]).toBeLessThanOrEqual(speeds[index - 1]);
    // The reel covers most of the brake in its first half and then crawls into the marker.
    const covered = (u: number) =>
      spinTravel(plan, plan.cruiseEnd + u * plan.brake);
    expect(covered(0.5)).toBeGreaterThan(plan.distance * 0.7);
    expect(covered(1) - covered(0.9)).toBeLessThan(plan.distance * 0.1);
  });

  it("lands the rolled dish exactly under the marker", () => {
    // The landing slot keeps the residue of the rolled dish.
    expect(plan.slot % 4).toBe(2);
    // The card of the landing slot rests in the middle of the track.
    expect(restingTravel(geometry, plan.slot)).toBeCloseTo(plan.travel, 5);
    // The reel really stops there.
    expect(spinTravel(plan, plan.cruiseEnd + plan.brake)).toBeCloseTo(
      plan.travel,
      5,
    );
    // The marker sits in the middle of the track.
    expect(markerOffset(geometry)).toBe(947 / 2 - 16 - 250 / 2);
  });

  it("takes about five seconds for the whole spin", () => {
    expect(spinDuration).toBe(5000);
    expect(cruiseDuration + brakeDuration).toBe(spinDuration);
    expect(plan.cruiseEnd + plan.brake).toBeGreaterThan(4000);
    expect(plan.cruiseEnd + plan.brake).toBeLessThan(6000);
  });

  it("fills the track with cards for the whole run", () => {
    const run = planSpin(geometry, 0, 4);
    const slots = reelLength(geometry, run.travel);
    // The reel reaches past the right edge of the track.
    expect(slots * geometry.step).toBeGreaterThan(
      run.travel + geometry.trackWidth,
    );
    // The landing slot of a real spin is inside the reel.
    expect(run.slot).toBeLessThan(reelLength(geometry, maxTravel()));
  });
});
