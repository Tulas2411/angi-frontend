/**
 * The spin of the roll strip.
 *
 * The strip is a reel of cards that is pulled to the left. `travel` is the number of pixels the
 * reel has travelled; the card under the marker is the one whose centre sits in the middle of the
 * track. The reel turns fast first and then brakes with an easing that starts at the cruise speed
 * and ends at a full stop, the way a case opening slows down before it lands.
 */

/** The fast phase, in pixels per second. */
export const cruiseSpeed = 2400;
/** The fast phase, in milliseconds. */
export const cruiseDuration = 2200;
/** The slow phase, in milliseconds. */
export const brakeDuration = 2800;
/**
 * The shape of the slow phase. The bigger the number, the later the reel slows down: the reel
 * keeps most of its speed at first and then crawls into the marker.
 */
export const brakeShape = 2.6;
/** The pixels the reel covers while it brakes. It starts at the cruise speed, so it takes the
 * shape to cover exactly this distance in the brake time. */
export const brakeDistance =
  (cruiseSpeed * brakeDuration) / 1000 / brakeShape;
/** The whole spin lasts this long: the fast phase and the slow phase. */
export const spinDuration = cruiseDuration + brakeDuration;

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

/** The plan of the brake that ends a spin. */
export interface BrakePlan {
  /** The slot that comes to rest under the marker; it holds the rolled dish. */
  slot: number;
  /** The travel of the resting reel. */
  travel: number;
  /** The pixels the reel covers while it brakes. */
  distance: number;
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

/** The travel of the fast phase. It never runs further than the cruise distance. */
export function cruiseTravel(elapsed: number): number {
  return (cruiseSpeed * Math.min(cruiseDuration, Math.max(0, elapsed))) / 1000;
}

/**
 * The travel of the slow phase. The easing `1 − (1 − u)^shape` starts at the cruise speed and
 * comes to a full stop, so the reel slows down late and lands softly.
 */
export function brakeTravel(from: number, distance: number, u: number): number {
  const clamped = Math.min(1, Math.max(0, u));
  return from + distance * (1 - Math.pow(1 - clamped, brakeShape));
}

/** The speed of the slow phase at `u`, in pixels per second. */
export function brakeSpeed(u: number, distance: number): number {
  const clamped = Math.min(1, Math.max(0, u));
  return (
    ((distance * brakeShape * Math.pow(1 - clamped, brakeShape - 1)) /
      brakeDuration) *
    1000
  );
}

/** How long a brake over `distance` pixels lasts. */
export function brakeDurationFor(distance: number): number {
  return (brakeDistance * brakeDuration) / Math.max(1, distance);
}

/**
 * The plan of the brake that starts at `travel`: the slot that comes to rest under the marker and
 * the distance the reel still has to cover. The slot keeps the residue of the rolled dish inside
 * the cycle, so the winner is the card that rests under the marker.
 */
export function planBrake(
  geometry: StripGeometry,
  travel: number,
  residue: number,
  cycleLength: number,
): BrakePlan {
  const length = Math.max(1, cycleLength);
  // The slot whose brake lasts closest to the wanted run wins, so the reel always slows down in
  // the same rhythm.
  let slot = -1;
  let distance = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let round = 0; round < 200; round += 1) {
    const candidate = residue + round * length;
    const run = restingTravel(geometry, candidate) - travel;
    if (run > 0) {
      const score = Math.abs(run - brakeDistance);
      if (score < best) {
        best = score;
        slot = candidate;
        distance = run;
      }
    }
    if (run > brakeDistance * 3) break;
  }
  if (slot < 0) {
    slot = Math.max(0, residue);
    distance = Math.max(1, restingTravel(geometry, slot) - travel);
  }
  return { slot, travel: restingTravel(geometry, slot), distance };
}

/** The cards the reel needs so its right end still fills the track at `travel`. */
export function reelLength(geometry: StripGeometry, travel: number): number {
  return Math.max(
    1,
    Math.ceil((travel + geometry.trackWidth - geometry.base) / geometry.step) + 1,
  );
}

/** The furthest the reel can travel: the fast phase plus the slow phase. */
export function maxTravel(): number {
  return cruiseTravel(cruiseDuration) + brakeDistance;
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
