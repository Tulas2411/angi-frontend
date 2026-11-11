/** Parsing and formatting behind the date and time pickers (values stay ISO, display is Vietnamese). */

const pad = (value: number) => String(value).padStart(2, "0");

/** A calendar day `yyyy-mm-dd` as a local Date (no time zone shift), or null when it is not a day. */
export function isoToDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function dateToIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2026-11-06` → `06/11/2026`; anything else unchanged. */
export function isoToDisplay(value: string) {
  const date = isoToDate(value);
  return date
    ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
    : value;
}

/** What a person types: `6/11/2026`, `06-11-2026` or `2026-11-06`. Null when it is not a real day. */
export function parseTypedDate(text: string): string | null {
  const trimmed = text.trim();
  if (isoToDate(trimmed)) return trimmed;
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const iso = `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`;
  return isoToDate(iso) ? iso : null;
}

/** `7:5`, `07:05`, `0705` or `7h05` → `07:05`; null when it is not a time of day. */
export function parseTypedTime(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  const match =
    /^(\d{1,2})\s*[:h.]\s*(\d{1,2})$/.exec(trimmed) ??
    /^(\d{2})(\d{2})$/.exec(trimmed) ??
    /^(\d{1,2})\s*h?$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** Within `min`/`max` (both inclusive, ISO days); an empty bound is open. */
export function dateInRange(value: string, min?: string, max?: string) {
  return (!min || value >= min) && (!max || value <= max);
}

export const pickerHours = Array.from({ length: 24 }, (_, hour) => pad(hour));
export const pickerMinutes = Array.from({ length: 12 }, (_, step) =>
  pad(step * 5),
);
