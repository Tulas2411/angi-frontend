"use client";

/**
 * The page numbers to show: the first, the last, the current page and its two
 * neighbours. The gaps between them are marked so the row can show "…".
 */
export function notificationPageNumbers(
  current: number,
  pages: number,
): (number | "gap")[] {
  if (pages <= 6) return Array.from({ length: pages }, (_, index) => index + 1);
  const shown = new Set<number>([1, pages]);
  for (const page of [current - 1, current, current + 1])
    if (page > 1 && page < pages) shown.add(page);
  const sorted = [...shown].sort((a, b) => a - b);
  const numbers: (number | "gap")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) numbers.push("gap");
    numbers.push(page);
    previous = page;
  }
  return numbers;
}
