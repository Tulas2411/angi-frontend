/**
 * The spin of the roll strip: the dish cycle turns fast, then slows down until the landing card
 * rests under the marker. The rolled dish waits in that slot.
 */

/** The fast phase, in pixels per second. */
export const cruiseSpeed = 2600;
/** The slow phase, in milliseconds. */
export const settleDuration = 1500;
/** The slow phase starts at this multiple of its average speed and ends at a full stop. */
export const settleShape = 3;
/** The fast phase is never shorter, so a quick answer still reads as a spin. */
export const minimumCruise = 700;

/** The strip's geometry, measured from the DOM before a spin starts. */
export interface StripGeometry {
  /** Width of the visible track. */
  trackWidth: number;
  /** Width of one card. */
  cardWidth: number;
  /** Distance between two cards. */
  gap: number;
  /** Distance between the left edges of two cards. */
  step: number;
  /** The first card's left edge, measured from the strip's left edge. */
  base: number;
}

/** The geometry of the strip inside the track. */
export function readGeometry(track: HTMLElement): StripGeometry {
  const style = getComputedStyle(track);
  const number = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  const cardWidth = number("--roll-card-w", 250);
  const gap = number("--roll-gap", 16);
  const base = number("--roll-base", 16);
  return {
    trackWidth: track.getBoundingClientRect().width,
    cardWidth,
    gap,
    step: cardWidth + gap,
    base,
  };
}

/**
 * The translateX that rests the card at `index` under the marker. The card's centre has to sit
 * exactly in the middle of the track.
 */
export function restingTranslate(
  geometry: StripGeometry,
  index: number,
): number {
  return (
    geometry.trackWidth / 2 -
    geometry.base -
    index * geometry.step -
    geometry.cardWidth / 2
  );
}

/**
 * The translateX of the revealed row: the rolled dish is the third of five cards, so it rests
 * under the marker in the same place the landing card did.
 */
export function revealTranslate(geometry: StripGeometry): number {
  return restingTranslate(geometry, 2);
}

/**
 * The distance the strip covers while it slows down: enough to feel like a real deceleration and
 * far enough that the landing card is still off screen when the rolled dish takes its slot.
 */
export function settleDistance(geometry: StripGeometry): number {
  const average = (cruiseSpeed * settleDuration) / 1000 / settleShape;
  const hidden = geometry.trackWidth / 2 + geometry.cardWidth + 120;
  return Math.max(average, hidden);
}

/** The card that comes to rest under the marker after `distance` pixels of the slow phase. */
export function landingIndex(
  geometry: StripGeometry,
  x: number,
  distance: number,
): number {
  const centre = geometry.trackWidth / 2 - geometry.base - geometry.cardWidth / 2;
  return Math.max(0, Math.round((centre - x + distance) / geometry.step));
}

/**
 * The slow phase's easing: it starts at the cruise speed and comes to a full stop. The cubic
 * `s·u + (3 − 2s)·u² + (s − 2)·u³` starts with the slope `s` and ends with the slope 0.
 */
export function settleEase(u: number, shape: number = settleShape): number {
  const clamped = Math.min(1, Math.max(0, u));
  return (
    shape * clamped +
    (3 - 2 * shape) * clamped * clamped +
    (shape - 2) * clamped * clamped * clamped
  );
}

/** The shape that makes the slow phase start at the cruise speed and cover `distance` pixels. */
export function settleShapeFor(distance: number): number {
  const limit = (cruiseSpeed * settleDuration) / 1000;
  return Math.min(6, Math.max(1, limit / Math.max(1, distance)));
}

/** The cards the strip needs so its right end still fills the track at `x`. */
export function cardCount(geometry: StripGeometry, x: number): number {
  const needed = (-x + geometry.trackWidth - geometry.base) / geometry.step;
  return Math.max(1, Math.ceil(needed) + 2);
}
