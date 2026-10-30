/**
 * The spin of the roll strip.
 *
 * The strip is a reel of cards that is pulled to the left. `travel` is the number of pixels the
 * reel has travelled; the card under the marker is the one whose centre sits in the middle of the
 * track.
 *
 * The whole movement is one continuous function of time:
 *
 *   travel(t) = rate·t                                    while the reel waits for the answer
 *   travel(t) = from + distance·p((t − brakeAt)/D)         while the reel brakes
 *
 * with the position profile `p(u) = 1 − (1 − u)^ease`. The shape `ease` is derived from the
 * distance the brake actually covers, so the profile's speed is exactly the cruise speed at the
 * start of the brake and 0 at its end: the speed never jumps and the reel never appears to
 * stutter.
 */

/** The fast phase, in pixels per second. */
export const cruiseSpeed = 2400;
/** The whole spin lasts this long: the fast phase and the slow phase. */
export const spinDuration = 10000;
/**
 * The wanted shape of the slow phase. The bigger the number, the later the reel slows down: with
 * 4 the reel keeps most of its speed and then crawls into the marker, the way a case opening
 * settles on its item.
 */
export const brakeEase = 4;
/**
 * The moment the brake begins, in milliseconds after the reel starts. The reel turns at the
 * cruise speed until then, so the slow phase has room to land the winner.
 */
export const desiredCruise = 5500;
/** The slow phase is never shorter than this. */
export const minimumBrake = 1500;

/** The cruise speed in pixels per millisecond. */
const rate = cruiseSpeed / 1000;

/** The strip's layout, measured from the track before a spin starts. */
export interface StripGeometry {
  /** Width of the visible track. */
  trackWidth: number;
  /** Width of one card. */
  cardWidth: number;
  /** The distance between the left edges of two cards. */
  step: number;
  /** The space before the first card of the strip. */
  base: number;
}

/** The plan of one spin. */
export interface SpinPlan {
  /** The slot that comes to rest under the marker; it holds the rolled dish. */
  landing: number;
  /** The length of the slow phase, in milliseconds. */
  duration: number;
  /** The pixels the reel covers while it brakes. */
  distance: number;
  /** The shape of the slow phase, derived from the distance. */
  ease: number;
  /** The travel of the resting reel. */
  travel: number;
}

/** How far the marker sits from the reel's origin. */
export function markerOffset(geometry: StripGeometry): number {
  return geometry.trackWidth / 2 - geometry.base - geometry.cardWidth / 2;
}

/** The travel that rests the card at `slot` under the marker. */
export function restingTravel(
  geometry: StripGeometry,
  slot: number,
): number {
  return slot * geometry.step - markerOffset(geometry);
}

/** The travel of the fast phase. It is not capped, so the reel keeps turning while it waits. */
export function cruiseTravel(elapsed: number): number {
  return rate * Math.max(0, elapsed);
}

/**
 * The plan of the brake.
 *
 * The reel turns at the cruise speed until `brakeAt`, then the slow phase takes the rest of the
 * spin. The landing slot keeps the residue of the rolled dish inside the reel's cycle, so the
 * winner is the card that comes to rest under the marker; the slot whose brake covers the wanted
 * distance closest wins, so the reel slows down in the same rhythm on every roll. The shape of
 * the brake follows from the distance it actually covers: the reel's speed is the cruise speed
 * at the start of the brake and a full stop at its end, so it never jumps.
 */
export function planSpin(
  geometry: StripGeometry,
  residue: number,
  cycleLength: number,
  from: number,
  brakeAt: number,
): SpinPlan {
  const length = Math.max(1, cycleLength);
  // The brake takes the rest of the spin: the reel stops exactly `spinDuration` after it began.
  const duration = Math.max(minimumBrake, spinDuration - brakeAt);
  // The distance that fits the wanted rhythm.
  const wanted = (rate * duration) / brakeEase;
  // The slot of the winner's residue whose brake covers that distance closest.
  const target = (from + wanted + markerOffset(geometry)) / geometry.step;
  let landing = -1;
  let best = Number.POSITIVE_INFINITY;
  for (let round = 0; round < 400; round += 1) {
    const slot = residue + round * length;
    if (slot < 1) continue;
    const score = Math.abs(slot - target);
    if (score < best) {
      best = score;
      landing = slot;
    }
    if (slot > target + length) break;
  }
  if (landing < 0) landing = Math.max(1, residue);
  const travel = restingTravel(geometry, landing);
  const distance = Math.max(1, travel - from);
  return {
    landing,
    duration,
    distance,
    // The shape that makes the brake start at the cruise speed and stop on the landing slot.
    ease: (rate * duration) / distance,
    travel,
  };
}

/**
 * The travel of the slow phase. The profile `1 − (1 − u)^ease` starts with the slope `ease`, so
 * the reel's speed at the start of the brake equals the cruise speed, and it ends at a full stop.
 */
export function brakeTravel(
  from: number,
  distance: number,
  u: number,
  ease: number,
): number {
  const clamped = Math.min(1, Math.max(0, u));
  return from + distance * (1 - Math.pow(1 - clamped, ease));
}

/** The speed of the slow phase at `u`, in pixels per second. */
export function brakeSpeed(
  u: number,
  distance: number,
  duration: number,
  ease: number,
): number {
  const clamped = Math.min(1, Math.max(0, u));
  return (
    (distance * ease * Math.pow(1 - clamped, ease - 1) * 1000) / duration
  );
}

/** The cards the reel needs so its right end still fills the track at `travel`. */
export function reelLength(geometry: StripGeometry, travel: number): number {
  return Math.max(
    1,
    Math.ceil((travel + geometry.trackWidth - geometry.base) / geometry.step) + 1,
  );
}

/** The furthest the reel can travel: the cruise speed for the whole spin. */
export function maxTravel(): number {
  return rate * spinDuration;
}

/** The geometry of the strip the track shows right now. */
export function readGeometry(track: HTMLElement): StripGeometry {
  const style = getComputedStyle(track);
  const value = (name: string, fallback: number) => {
    const parsed = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const cardWidth = value("--roll-card-w", 250);
  const gap = value("--roll-gap", 16);
  return {
    trackWidth: track.getBoundingClientRect().width,
    cardWidth,
    step: cardWidth + gap,
    base: value("--roll-base", 16),
  };
}
