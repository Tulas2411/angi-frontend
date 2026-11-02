/**
 * The spin of the roll strip.
 *
 * The strip is a reel of cards that is pulled to the left. `travel` is the number of pixels the
 * reel has travelled; the card under the marker is the one whose centre sits in the middle of the
 * track.
 *
 * The whole spin is planned before it starts: the reel winds up to the cruise speed, turns at
 * that speed and then brakes to a full stop on the rolled dish. The speed is the same at both
 * ends of every phase, so the reel never appears to stutter: it never stands still in the middle
 * of the spin and its speed never jumps where the brake begins.
 */

/** The fast phase, in pixels per second. */
export const cruiseSpeed = 2400;
/** How long the reel winds up from a standstill, in milliseconds. */
export const rampDuration = 140;
/** How long the reel turns at the cruise speed before it brakes, in milliseconds. */
export const cruiseDuration = 2200;
/**
 * The shape of the slow phase. The speed at `u` is `cruiseSpeed·(1 − u)^(shape − 1)`: the reel
 * keeps most of its speed at first and then crawls into the marker. The bigger the number, the
 * later the reel slows down.
 */
export const brakeShape = 2.6;
/** How long the reel brakes to a full stop, in milliseconds. */
export const brakeDuration = 2800;
/** The whole spin, in milliseconds: the fast phase and the slow phase. */
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

/** The plan of a spin: where it slows down and where it stops. */
export interface SpinPlan {
  /** When the brake starts, in milliseconds from the start of the spin. */
  cruiseEnd: number;
  /** How long the slow phase lasts, in milliseconds. */
  brake: number;
  /** The travel when the brake starts. */
  brakeStart: number;
  /** The pixels the reel covers while it brakes. */
  distance: number;
  /** The travel of the resting reel. */
  travel: number;
  /** The slot that comes to rest under the marker; it holds the rolled dish. */
  slot: number;
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

/**
 * The travel of the fast phase. It is never clamped: the reel keeps turning at the cruise speed
 * until the brake starts, so it never stands still in the middle of a spin.
 */
export function cruiseTravel(elapsed: number): number {
  const t = Math.max(0, elapsed);
  if (t <= rampDuration)
    return (cruiseSpeed * t * t) / (2000 * rampDuration);
  return (
    (cruiseSpeed * rampDuration) / 2000 +
    (cruiseSpeed * (t - rampDuration)) / 1000
  );
}

/** The pixels the reel covers per millisecond while it brakes, on average. */
export function brakeRate(): number {
  return cruiseSpeed / (1000 * brakeShape);
}

/** The furthest the reel travels in a spin, with room for the rounding of the landing slot. */
export function maxTravel(): number {
  return cruiseTravel(cruiseDuration) + brakeRate() * brakeDuration + 600;
}

/**
 * The plan of the spin that ends on the rolled dish.
 *
 * The landing slot and the brake belong together: the slot fixes the distance the brake has to
 * cover, and the distance fixes how long the brake takes, so the brake always starts at exactly
 * the cruise speed and ends at a full stop. The speed therefore never jumps where the brake
 * begins.
 *
 * The landing slot keeps the residue of the rolled dish, so the winner is the card that comes to
 * rest under the marker.
 */
export function planSpin(
  geometry: StripGeometry,
  residue: number,
  cycleLength: number,
): SpinPlan {
  const length = Math.max(1, cycleLength);
  const start = cruiseTravel(cruiseDuration);
  const ideal = brakeRate() * brakeDuration;
  // The slots of the rolled dish, from the closest one to the start of the brake. The slot whose
  // distance is closest to the ideal brake distance wins, so the reel always slows down in the
  // same rhythm.
  let slot = Math.max(0, residue);
  let distance = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let round = 0; round < 400; round += 1) {
    const candidate = residue + round * length;
    const run = restingTravel(geometry, candidate) - start;
    if (run > 0) {
      const score = Math.abs(run - ideal);
      if (score < best) {
        best = score;
        slot = candidate;
        distance = run;
      }
      if (run > ideal + geometry.step) break;
    }
  }
  if (distance <= 0) distance = Math.max(1, ideal);
  // A brake that starts at the cruise speed and ends at a full stop lasts exactly this long.
  const brake = (distance * brakeShape * 1000) / cruiseSpeed;
  return {
    cruiseEnd: cruiseDuration,
    brake,
    brakeStart: start,
    distance,
    travel: start + distance,
    slot,
  };
}

/**
 * The travel of a spin at `elapsed` milliseconds. The curve is continuous: the wind-up ends at the
 * cruise speed, the fast phase ends at the cruise speed and the slow phase ends at a full stop.
 */
export function spinTravel(plan: SpinPlan, elapsed: number): number {
  const t = Math.max(0, elapsed);
  if (t <= plan.cruiseEnd) return cruiseTravel(t);
  const u = Math.min(1, (t - plan.cruiseEnd) / plan.brake);
  return (
    plan.brakeStart +
    plan.distance * (1 - Math.pow(1 - u, brakeShape))
  );
}

/** The speed of a spin at `elapsed` milliseconds, in pixels per second. */
export function spinSpeed(plan: SpinPlan, elapsed: number): number {
  const t = Math.max(0, elapsed);
  if (t <= rampDuration) return (cruiseSpeed * t) / rampDuration;
  if (t <= plan.cruiseEnd) return cruiseSpeed;
  const u = Math.min(1, (t - plan.cruiseEnd) / plan.brake);
  return (
    (plan.distance * brakeShape * 1000 * Math.pow(1 - u, brakeShape - 1)) /
    plan.brake
  );
}

/** The cards the reel needs so its right end still fills the track at `travel`. */
export function reelLength(geometry: StripGeometry, travel: number): number {
  return Math.max(
    1,
    Math.ceil((travel + geometry.trackWidth - geometry.base) / geometry.step) +
      1,
  );
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
