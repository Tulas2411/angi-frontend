import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  CreateRoadmapRequestDto,
  RoadmapFormValues,
  RoadmapOrigin,
  RoadmapOriginMode,
  RoadmapSummaryDto,
  UpdateRoadmapRequestDto,
} from "./roadmap-types";

export const roadmapLimits = {
  title: 200,
  originLabel: 200,
  minDays: 1,
  /** Product limit of the app; RM-01 itself accepts 1..30 (API Design v1.8). */
  maxDays: 7,
} as const;

export const emptyRoadmapForm: RoadmapFormValues = {
  province: "",
  title: "",
  startDate: "",
  numDays: "3",
  budgetAmount: "",
  originMode: "none",
  originLabel: "",
};

export const originModeLabels: Record<RoadmapOriginMode, string> = {
  pinned: "Chấm trên bản đồ",
  gps: "Vị trí hiện tại",
  none: "Chưa có vị trí",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Calendar arithmetic on `yyyy-MM-dd` values, independent of the browser time zone. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseDays(value: string): number | null {
  const days = Number(value.trim());
  return value.trim() && Number.isInteger(days) ? days : null;
}

function parseBudget(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : Number.NaN;
}

/** Mirrors RoadmapSummary.endDate: startDate + numDays − 1. */
export function roadmapEndDate(startDate: string, numDays: string) {
  const days = parseDays(numDays);
  if (!isDateOnly(startDate) || days === null) return null;
  if (days < roadmapLimits.minDays || days > roadmapLimits.maxDays) return null;
  return addDays(startDate, days - 1);
}

/** "Thành phố Hà Nội" → "Hà Nội"; keeps the input when it has no administrative prefix. */
export function shortProvinceName(province: string) {
  return province
    .trim()
    .replace(/^(thành phố|tỉnh)\s+/i, "")
    .trim();
}

export function suggestRoadmapTitle(province: string, numDays: string) {
  const place = shortProvinceName(province);
  if (!place) return "";
  const days = parseDays(numDays);
  return days && days >= roadmapLimits.minDays && days <= roadmapLimits.maxDays
    ? `${days} ngày ăn ngon ${place}`
    : `Ăn ngon ${place}`;
}

export function isValidOrigin(origin: RoadmapOrigin | null) {
  return (
    !!origin &&
    Number.isFinite(origin.latitude) &&
    Number.isFinite(origin.longitude) &&
    Math.abs(origin.latitude) <= 90 &&
    Math.abs(origin.longitude) <= 180
  );
}

/** RM-01/RM-04 field rules. The destination is asked only when a roadmap is planned. */
export function validateRoadmapForm(
  values: RoadmapFormValues,
  origin: RoadmapOrigin | null,
  { requireProvince = true }: { requireProvince?: boolean } = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (requireProvince && !values.province.trim())
    errors.province = "Chọn tỉnh / thành phố bạn muốn đến.";
  const title = values.title.trim();
  if (!title) errors.title = "Tên lộ trình là bắt buộc.";
  else if (title.length > roadmapLimits.title)
    errors.title = `Tên lộ trình không được vượt quá ${roadmapLimits.title} ký tự.`;
  if (values.startDate && !isDateOnly(values.startDate))
    errors.startDate = "Ngày bắt đầu không hợp lệ.";
  const days = parseDays(values.numDays);
  if (
    days === null ||
    days < roadmapLimits.minDays ||
    days > roadmapLimits.maxDays
  )
    errors.numDays = `Số ngày phải là số nguyên từ ${roadmapLimits.minDays} đến ${roadmapLimits.maxDays}.`;
  const budget = parseBudget(values.budgetAmount);
  if (budget !== null && (Number.isNaN(budget) || budget < 0))
    errors.budgetAmount = "Ngân sách phải là số không âm.";
  if (values.originMode === "pinned") {
    if (!isValidOrigin(origin))
      errors.origin =
        "Chấm điểm xuất phát trên bản đồ hoặc nhập tọa độ hợp lệ.";
    if (values.originLabel.trim().length > roadmapLimits.originLabel)
      errors.originLabel = `Tên điểm xuất phát không được vượt quá ${roadmapLimits.originLabel} ký tự.`;
  }
  return errors;
}

const coordinate = (value: number) => Number(value.toFixed(6));

/** RM-01 body: optional values are omitted; coordinates are sent only for a pinned origin. */
export function buildCreateRoadmapRequest(
  values: RoadmapFormValues,
  origin: RoadmapOrigin | null,
): CreateRoadmapRequestDto {
  const request: CreateRoadmapRequestDto = {
    title: values.title.trim(),
    numDays: Number(values.numDays.trim()),
    originMode: values.originMode,
  };
  if (values.startDate) request.startDate = values.startDate;
  const budget = parseBudget(values.budgetAmount);
  if (budget !== null) request.budgetAmount = budget;
  if (values.originMode === "pinned" && origin) {
    request.originLatitude = coordinate(origin.latitude);
    request.originLongitude = coordinate(origin.longitude);
    const label = values.originLabel.trim();
    if (label) request.originLabel = label;
  }
  return request;
}

export function roadmapFormFromSummary(
  summary: RoadmapSummaryDto,
): RoadmapFormValues {
  return {
    province: "",
    title: summary.title,
    startDate: summary.startDate ?? "",
    numDays: String(summary.numDays),
    budgetAmount:
      summary.budgetAmount === null ? "" : String(summary.budgetAmount),
    originMode: summary.originMode,
    originLabel: summary.originLabel ?? "",
  };
}

export function originFromSummary(
  summary: RoadmapSummaryDto,
): RoadmapOrigin | null {
  if (
    summary.originMode !== "pinned" ||
    summary.originLatitude === null ||
    summary.originLongitude === null
  )
    return null;
  return {
    name: summary.originLabel ?? "Điểm xuất phát",
    latitude: summary.originLatitude,
    longitude: summary.originLongitude,
  };
}

/**
 * RM-04 body with only the changed fields. Leaving `pinned` sends just the new mode:
 * the backend clears the stored coordinates and label itself.
 */
export function buildRoadmapPatch(
  values: RoadmapFormValues,
  origin: RoadmapOrigin | null,
  summary: RoadmapSummaryDto,
): UpdateRoadmapRequestDto {
  const patch: UpdateRoadmapRequestDto = {};
  const title = values.title.trim();
  if (title !== summary.title) patch.title = title;
  const startDate = values.startDate || null;
  if (startDate !== summary.startDate) patch.startDate = startDate;
  const numDays = Number(values.numDays.trim());
  if (numDays !== summary.numDays) patch.numDays = numDays;
  const budget = parseBudget(values.budgetAmount);
  if (budget !== summary.budgetAmount) patch.budgetAmount = budget;
  if (values.originMode !== summary.originMode)
    patch.originMode = values.originMode;
  if (values.originMode === "pinned" && origin) {
    const latitude = coordinate(origin.latitude);
    const longitude = coordinate(origin.longitude);
    if (latitude !== summary.originLatitude) patch.originLatitude = latitude;
    if (longitude !== summary.originLongitude)
      patch.originLongitude = longitude;
    const label = values.originLabel.trim() || null;
    if (label !== summary.originLabel) patch.originLabel = label;
  }
  return patch;
}

/** Maps VALIDATION_FAILED keys (any casing) onto the form fields that show them. */
export function roadmapFieldErrors(
  errors?: Record<string, string[]>,
): Record<string, string> {
  const names: Record<string, string> = {
    title: "title",
    startdate: "startDate",
    numdays: "numDays",
    budgetamount: "budgetAmount",
    originmode: "origin",
    originlatitude: "origin",
    originlongitude: "origin",
    originlabel: "originLabel",
  };
  const fields: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const field = names[key.toLowerCase()] ?? key;
    fields[field] = [fields[field], ...messages].filter(Boolean).join(" ");
  }
  return fields;
}

export function roadmapErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.errorCode === "DAY_NOT_EMPTY")
      return "Không thể giảm số ngày vì những ngày bị bỏ vẫn còn món. Hãy xóa món ở các ngày đó trước.";
    if (error.errorCode === "ROADMAP_NOT_FOUND")
      return "Không tìm thấy lộ trình này hoặc lộ trình không thuộc về bạn.";
  }
  return getErrorMessage(error);
}

/**
 * Destination province taken from a picked origin. `resolveRestaurantAddress` fills
 * `addressDetails.provinceName` with the catalog name when it could match one; an empty
 * name means the address was found but not matched.
 */
export function provinceFromOrigin(point: RoadmapOrigin): {
  province: string;
  notice: string;
} {
  const province = point.addressDetails?.provinceName.trim() ?? "";
  return province
    ? {
        province,
        notice: `Đã điền tỉnh / thành phố theo điểm đã chấm: ${province}.`,
      }
    : {
        province: "",
        notice:
          "Chưa tự lấy được tỉnh / thành phố từ điểm đã chấm. Bạn hãy chọn tỉnh / thành phố ở trên.",
      };
}

export type GpsProblem = "denied" | "insecure" | "unavailable" | "timeout";

/** Browser geolocation errors: 1 permission denied, 2 position unavailable, 3 timeout. */
export function classifyGpsError(
  code: number,
  secureContext: boolean,
): GpsProblem {
  // Browsers never prompt outside a secure context; they report it as "denied".
  if (!secureContext) return "insecure";
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

export const gpsProblemMessages: Record<GpsProblem, string> = {
  denied:
    "Trình duyệt đang chặn vị trí của trang này nên không hiện hộp xin quyền. Bấm biểu tượng ổ khóa (hoặc biểu tượng vị trí) cạnh thanh địa chỉ, đặt Vị trí thành Cho phép, rồi bấm lại “Vị trí hiện tại”. Bạn cũng có thể chấm điểm xuất phát trên bản đồ.",
  insecure:
    "Trình duyệt chỉ hỏi quyền vị trí khi trang chạy qua https hoặc http://localhost. Hãy mở ANGI bằng một trong hai cách đó, hoặc chấm điểm xuất phát trên bản đồ.",
  unavailable:
    "Thiết bị chưa cung cấp được vị trí. Hãy bật dịch vụ vị trí của hệ điều hành (Windows: Cài đặt > Quyền riêng tư > Vị trí) rồi thử lại, hoặc chấm điểm xuất phát trên bản đồ.",
  timeout:
    "Quá thời gian chờ vị trí. Hãy thử lại hoặc chấm điểm xuất phát trên bản đồ.",
};

/** roadmaps.budget_amount is numeric(14,0): whole VND, at most 14 digits. */
export const budgetMaxDigits = 14;
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
 * Backspace never gets stuck on "." or "VND".
 */
export function applyVndEdit(
  previous: string,
  typed: string,
  caret: number,
  deleting: boolean,
): { digits: string; caret: number } {
  let digits = digitsOf(typed);
  let before = digitsOf(typed.slice(0, caret)).length;
  if (deleting && digits === previous && before > 0) {
    digits = digits.slice(0, before - 1) + digits.slice(before);
    before -= 1;
  }
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  before = Math.max(0, before - (digits.length - trimmed.length));
  digits = trimmed.slice(0, budgetMaxDigits);
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
