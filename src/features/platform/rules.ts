import type {
  AppData,
  OverrideValue,
  Permission,
  SyncEvent,
  Trip,
} from "./contracts";

export function snapshotTrip(
  trip: Trip,
  data: Pick<AppData, "dishes" | "restaurants">,
): Trip {
  const copy = structuredClone(trip);
  copy.readOnly = true;
  copy.days.forEach((day) =>
    day.items.forEach((item) => {
      const dish = data.dishes.find((d) => d.id === item.dishId);
      const restaurant = data.restaurants.find(
        (r) => r.id === item.restaurantId,
      );
      item.snapshot = {
        dishName: dish?.name ?? "Món không còn khả dụng",
        restaurantName: restaurant?.name ?? "Quán không còn khả dụng",
        price: dish?.price ?? 0,
      };
    }),
  );
  return copy;
}

export function serializeOverrides(
  values: Record<string, OverrideValue>,
  permissions: Permission[],
) {
  return permissions
    .filter(
      (p) => p.grantable && values[p.code] && values[p.code] !== "inherit",
    )
    .map((p) => ({
      permission: p.code,
      effect: values[p.code] as "allow" | "deny",
    }));
}
export function effectivePermission(
  permission: Permission,
  override: OverrideValue,
) {
  return (
    permission.grantable &&
    (override === "allow" ||
      (override === "inherit" && permission.defaultAllowed))
  );
}
export function retrySyncEvent(event: SyncEvent): SyncEvent {
  if (event.status !== "dead") throw new Error("Chỉ thử lại sự kiện đang lỗi.");
  return { ...event, status: "pending", nextAttempt: null };
}
export function validateDateRange(start: string, end: string) {
  if (!start || !end) return "Chọn ngày bắt đầu và ngày kết thúc.";
  if (
    ![start, end].every(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value,
    )
  )
    return "Ngày không hợp lệ.";
  if (end < start) return "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
  return null;
}
export function tripDates(start: string, end: string) {
  if (validateDateRange(start, end)) return [];
  const dates: string[] = [];
  const day = new Date(start + "T00:00:00Z"),
    last = new Date(end + "T00:00:00Z");
  for (; day <= last; day.setUTCDate(day.getUTCDate() + 1))
    dates.push(day.toISOString().slice(0, 10));
  return dates;
}
export function validateUpload(
  file: Pick<File, "type" | "size">,
  documents = false,
) {
  const image = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const pdf = documents && file.type === "application/pdf";
  if (!image && !pdf)
    return documents
      ? "Chọn ảnh JPG, PNG, WEBP hoặc PDF."
      : "Chọn ảnh JPG, PNG hoặc WEBP.";
  if (file.size > (pdf ? 10 : 5) * 1024 * 1024)
    return pdf ? "PDF tối đa 10 MB." : "Mỗi ảnh tối đa 5 MB.";
  return null;
}
export function pageSlice<T>(items: T[], page: number, size = 5) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 1), pages);
  return {
    items: items.slice((current - 1) * size, current * size),
    total: items.length,
    page: current,
    pages,
    first: items.length ? (current - 1) * size + 1 : 0,
    last: Math.min(current * size, items.length),
  };
}
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(date.length === 10 ? date + "T00:00:00+07:00" : date));
