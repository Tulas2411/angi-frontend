/**
 * Reads a latitude/longitude pair typed or pasted into a map search box, in the forms Google Maps and
 * other apps copy: decimal degrees ("21.027651, 105.533428"), degrees-minutes-seconds
 * ("21°01'39.5"N 105°32'00.3"E") or degrees and decimal minutes ("21°01.658'N 105°32.005'E"), with or
 * without hemisphere letters (N/S/E/W, before or after). Latitude comes first unless the letters say
 * otherwise. Anything else (an address, a place name) is `null`, so the box searches it as text.
 */

/** One axis: degrees, optional minutes and seconds, optional hemisphere letter before or after. */
const axis =
  String.raw`([NSEW])?\s*(-?\d{1,3}(?:[.,]\d+)?)\s*(?:°|º|deg|\s)?\s*` +
  String.raw`(?:(\d{1,2}(?:[.,]\d+)?)\s*['′’]\s*)?` +
  String.raw`(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|″|”|''|′′)\s*)?([NSEW])?`;
const pair = new RegExp(String.raw`^\s*${axis}\s*[,;\s]\s*${axis}\s*$`, "i");
/** Plain decimal pair, where "," may also be the separator between the two numbers. */
const decimalPair =
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

const number = (text: string | undefined) =>
  text ? Number(text.replace(",", ".")) : 0;

function value(
  before: string | undefined,
  degrees: string,
  minutes: string | undefined,
  seconds: string | undefined,
  after: string | undefined,
) {
  const hemisphere = (after ?? before ?? "").toUpperCase();
  if (number(minutes) >= 60 || number(seconds) >= 60) return null;
  const magnitude =
    Math.abs(number(degrees)) + number(minutes) / 60 + number(seconds) / 3600;
  const negative =
    degrees.startsWith("-") || hemisphere === "S" || hemisphere === "W";
  return { value: negative ? -magnitude : magnitude, hemisphere };
}

export function parseCoordinates(
  text: string,
): { latitude: number; longitude: number } | null {
  let latitude: number;
  let longitude: number;
  const plain = decimalPair.exec(text);
  if (plain) {
    // Two whole numbers ("21 105", "5, 10") are more likely part of an address than a position.
    if (!plain[1].includes(".") && !plain[2].includes(".")) return null;
    latitude = Number(plain[1]);
    longitude = Number(plain[2]);
  } else {
    const match = pair.exec(text);
    if (!match) return null;
    const first = value(match[1], match[2], match[3], match[4], match[5]);
    const second = value(match[6], match[7], match[8], match[9], match[10]);
    if (!first || !second) return null;
    // Without any marker ("21 105") the text is not clearly coordinates: let the search handle it.
    const marked = /[°º'′’"″”NSEW]|deg/i.test(text) || /[.,]\d/.test(text);
    if (!marked) return null;
    const swapped =
      ["E", "W"].includes(first.hemisphere) ||
      ["N", "S"].includes(second.hemisphere);
    latitude = swapped ? second.value : first.value;
    longitude = swapped ? first.value : second.value;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** `21.027651, 105.533428`: how a picked pair is shown as the point's name. */
export const coordinatesLabel = (point: {
  latitude: number;
  longitude: number;
}) => `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
