import { describe, expect, it } from "vitest";
import {
  brakeDistance,
  brakeDuration,
  brakeTravel,
  cruiseDuration,
  cruiseSpeed,
  cruiseTravel,
  markerOffset,
  planBrake,
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
  it("turns fast first and then brakes to a full stop", () => {
    // The fast phase keeps the cruise speed.
    expect(cruiseTravel(0)).toBe(0);
    expect(cruiseTravel(1000)).toBe(cruiseSpeed);
    expect(cruiseTravel(cruiseDuration)).toBe(
      (cruiseSpeed * cruiseDuration) / 1000,
    );

    // The brake starts at the cruise speed and ends at a stop.
    const start = brakeTravel(1000, brakeDistance, 0);
    const early = brakeTravel(1000, brakeDistance, 0.1);
    const late = brakeTravel(1000, brakeDistance, 0.9);
    const end = brakeTravel(1000, brakeDistance, 1);
    expect(start).toBe(1000);
    expect(end).toBeCloseTo(1000 + brakeDistance, 5);
    // The reel runs fast at first and crawls into the marker: the last tenth of the brake covers
    // far less ground than the first tenth.
    expect(early - start).toBeGreaterThan((end - late) * 20);
  });

  it("lands the rolled dish exactly under the marker", () => {
    const travel = 1200;
    const residue = 1;
    const plan = planBrake(geometry, travel, residue, 4);
    // The landing slot keeps the residue of the rolled dish.
    expect(plan.slot % 4).toBe(residue);
    // The card of the landing slot rests in the middle of the track.
    expect(restingTravel(geometry, plan.slot)).toBe(plan.travel);
    // The marker sits in the middle of the track.
    expect(markerOffset(geometry)).toBe(947 / 2 - 16 - 250 / 2);
  });

  it("takes about five seconds for the whole spin", () => {
    expect(spinDuration).toBe(5000);
    expect(cruiseDuration + brakeDuration).toBe(spinDuration);
  });

  it("fills the track with cards for the whole run", () => {
    const travel = 12000;
    const slots = reelLength(geometry, travel);
    // The reel reaches past the right edge of the track.
    expect(slots * geometry.step).toBeGreaterThan(travel + geometry.trackWidth);
  });
});
