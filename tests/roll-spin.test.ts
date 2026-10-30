import { describe, expect, it } from "vitest";
import {
  brakeSpeed,
  brakeTravel,
  cruiseSpeed,
  cruiseTravel,
  desiredCruise,
  planSpin,
  reelLength,
  restingTravel,
  spinDuration,
} from "@/features/roll/roll-spin-rules";

/** The strip's layout on a 947px track with 250px cards and a 16px gap. */
const geometry = {
  trackWidth: 947,
  cardWidth: 250,
  step: 266,
  base: 16,
};

describe("roll spin", () => {
  it("keeps the speed continuous between the fast and the slow phase", () => {
    const plan = planSpin(
      geometry,
      0,
      4,
      cruiseTravel(desiredCruise),
      desiredCruise,
    );
    // The slow phase starts at exactly the cruise speed: the reel does not jump.
    expect(brakeSpeed(0, plan.distance, plan.duration, plan.ease)).toBeCloseTo(
      cruiseSpeed,
      5,
    );
    // The reel comes to a full stop.
    expect(brakeSpeed(1, plan.distance, plan.duration, plan.ease)).toBeCloseTo(
      0,
      5,
    );
  });

  it("keeps turning while it waits for the answer", () => {
    // The fast phase is not capped: the reel never stands still before the brake.
    expect(cruiseTravel(0)).toBe(0);
    expect(cruiseTravel(1000)).toBeCloseTo(cruiseSpeed, 5);
    expect(cruiseTravel(3000)).toBeCloseTo(cruiseSpeed * 3, 5);
  });

  it("falls from the cruise speed to a stop without a jump", () => {
    const plan = planSpin(
      geometry,
      0,
      4,
      cruiseTravel(desiredCruise),
      desiredCruise,
    );
    const speeds = [0, 0.25, 0.5, 0.75, 1].map((u) =>
      brakeSpeed(u, plan.distance, plan.duration, plan.ease),
    );
    // The speed never rises again.
    for (let index = 1; index < speeds.length; index += 1)
      expect(speeds[index]).toBeLessThan(speeds[index - 1]);
    // The reel comes to a full stop at the end.
    expect(speeds[speeds.length - 1]).toBeLessThan(1);
  });

  it("lands the rolled dish exactly under the marker", () => {
    const plan = planSpin(
      geometry,
      1,
      4,
      cruiseTravel(desiredCruise),
      desiredCruise,
    );
    // The landing slot keeps the residue of the rolled dish inside the cycle.
    expect(plan.landing % 4).toBe(1);
    // The card of the landing slot rests in the middle of the track.
    expect(restingTravel(geometry, plan.landing)).toBe(plan.travel);
    // The reel rests exactly there at the end of the brake.
    const end = brakeTravel(
      cruiseTravel(desiredCruise),
      plan.distance,
      1,
      plan.ease,
    );
    expect(end).toBeCloseTo(plan.travel, 5);
  });

  it("takes about ten seconds for the whole spin", () => {
    const plan = planSpin(
      geometry,
      0,
      4,
      cruiseTravel(desiredCruise),
      desiredCruise,
    );
    expect(spinDuration).toBe(10000);
    expect(desiredCruise + plan.duration).toBe(spinDuration);
    // The reel turns at full speed for the first half.
    expect(desiredCruise).toBeGreaterThan(spinDuration * 0.4);
  });

  it("fills the track with cards for the whole run", () => {
    const plan = planSpin(
      geometry,
      0,
      4,
      cruiseTravel(desiredCruise),
      desiredCruise,
    );
    const slots = reelLength(geometry, plan.travel);
    // The reel reaches past the right edge of the track.
    expect(slots * geometry.step).toBeGreaterThan(plan.travel + geometry.trackWidth);
  });
});
