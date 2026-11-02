/** Words of the third line before a long description is cut with "…". */
export const thirdLineWords = 7;

/**
 * Where to cut a description of `words` words. `fits(count, lines, withEllipsis)` says whether the
 * first `count` words (followed by " …" when asked) fit in `lines` lines of the card.
 *
 * The description keeps two full lines and about seven words of the third, then "…". Returns
 * `null` when the whole text fits that budget, so nothing is cut.
 */
export function cutDescription(
  words: number,
  fits: (count: number, lines: number, withEllipsis: boolean) => boolean,
  extraWords = thirdLineWords,
): number | null {
  if (words <= 0) return null;
  // The most words two lines hold.
  let low = 0;
  let high = words;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle, 2, false)) low = middle;
    else high = middle - 1;
  }
  const twoLines = low;
  const budget = twoLines + extraWords;
  if (words <= budget && fits(words, 3, false)) return null;
  // Seven words on the third line, fewer when long words do not leave room for "…".
  let cut = Math.min(budget, words);
  while (cut > twoLines && !fits(cut, 3, true)) cut -= 1;
  return Math.max(1, cut);
}
