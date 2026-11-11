/**
 * The menu wheel: plates sit on an endless wooden wheel, one every `wheelStep` degrees. `turn`
 * counts steps from the first dish and never wraps, so the wheel always turns the way it went;
 * the dish on plate `k` is `k mod n`.
 */

/** Degrees between two plates: the neighbours stay out of sight until the wheel turns. */
export const wheelStep = 70;

/** Plates drawn on each side of the travelled arc, so entering and leaving plates are on screen. */
export const wheelMargin = 1;

/** A one-step turn, and the longest turn however far the wheel goes (prompt §3.1, §3.3). */
export const turnMs = 650;
export const longTurnMs = 900;

/** `value mod n`, never negative. */
export function wrap(value: number, n: number) {
  return ((value % n) + n) % n;
}

/** The dish (index in the menu) on plate `turn`. */
export function dishAt(turn: number, n: number) {
  return n > 0 ? wrap(turn, n) : 0;
}

/**
 * Steps from plate `turn` to the nearest plate carrying dish `index`: the shortest way round,
 * forward on a tie. 0 when it is already there.
 */
export function stepsTo(turn: number, index: number, n: number) {
  if (n <= 1) return 0;
  const forward = wrap(index - dishAt(turn, n), n);
  return forward <= n / 2 ? forward : forward - n;
}

/** The plates to draw while the wheel goes from `from` to `to`, the travelled arc and a margin. */
export function platesBetween(from: number, to: number) {
  const low = Math.min(from, to) - wheelMargin;
  const high = Math.max(from, to) + wheelMargin;
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

/** How long a turn of `steps` plates takes: one step 650 ms, more steps faster each, 900 ms at most. */
export function turnDuration(steps: number) {
  const count = Math.abs(steps);
  if (count === 0) return 0;
  return Math.min(longTurnMs, turnMs + (count - 1) * 120);
}

/**
 * Where a drag lets go: the nearest plate, pushed one further by a quick flick (`velocity` in
 * steps per second, positive = towards the next dish).
 */
export function snapTurn(position: number, velocity: number) {
  const flick = Math.abs(velocity) > 1.2 ? Math.sign(velocity) * 0.5 : 0;
  return Math.round(position + flick) || 0;
}

/** "03 / 06": the dish number and the menu size, two digits at least. */
export function wheelCounter(index: number, n: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(index + 1)} / ${pad(n)}`;
}

/** "169.000đ" as on a menu card. */
export function menuPrice(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)}đ`;
}
