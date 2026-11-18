/**
 * Whole-VND text input rules shared by every money field (roadmap budget, dish price): the field shows
 * `1.500.000 VND` while the form keeps only the digits.
 */
const vndSuffix = " VND";

const digitsOf = (text: string) => text.replace(/\D/g, "");

/** `1500000` → `1.500.000 VND`; no digits → empty. */
export function formatVndInput(digits: string) {
  const clean = digitsOf(digits);
  return clean ? clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + vndSuffix : "";
}

/**
 * Applies one edit of the currency input. `previous` and the result are plain digits (what
 * the form stores and sends); `caret` is the position the browser reports in `typed`.
 * Deleting only a separator or the unit deletes the digit before the caret instead, so
 * Backspace never gets stuck on "." or "VND". At most `maxDigits` digits are kept.
 */
export function applyVndEdit(
  previous: string,
  typed: string,
  caret: number,
  deleting: boolean,
  maxDigits = 14,
): { digits: string; caret: number } {
  let digits = digitsOf(typed);
  let before = digitsOf(typed.slice(0, caret)).length;
  if (deleting && digits === previous && before > 0) {
    digits = digits.slice(0, before - 1) + digits.slice(before);
    before -= 1;
  }
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  before = Math.max(0, before - (digits.length - trimmed.length));
  digits = trimmed.slice(0, maxDigits);
  before = Math.min(before, digits.length);
  // Caret goes right after the `before`-th digit of the formatted text.
  const text = formatVndInput(digits);
  let seen = 0;
  let position = before === 0 ? 0 : text.length;
  for (let index = 0; before > 0 && index < text.length; index += 1) {
    if (/\d/.test(text[index])) seen += 1;
    if (seen === before) {
      position = index + 1;
      break;
    }
  }
  return { digits, caret: position };
}

/**
 * Digits of a pasted amount, read the Vietnamese way: "." and "," group thousands ("45.000", "45,000",
 * "1.500.000 VND", "45.000đ" are all 45 000 đồng). A trailing part of one or two digits after the last
 * separator is a fraction of a đồng and is dropped ("45.000,00" → 45000).
 */
export function vndDigitsFromPaste(text: string) {
  const amount = text
    .trim()
    .replace(/\s*(vnđ|vnd|đồng|dong|đ|₫)\s*$/i, "")
    .trim();
  const fraction = /^(.*\d)[.,]\d{1,2}$/.exec(amount);
  return digitsOf(fraction ? fraction[1] : amount);
}
