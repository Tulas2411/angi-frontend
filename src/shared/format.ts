/** Presentation helpers shared by the real business screens. */

export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );

/** Date-only values (`yyyy-MM-dd`) are Vietnam calendar days; other values are UTC instants. */
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(date.length === 10 ? date + "T00:00:00+07:00" : date));

/** "Vừa xong", "12 phút trước", "3 giờ trước", "Hôm qua", "12/10/2026"… */
export const relativeTimeLabel = (date: string) => {
  const ms =
    Date.now() -
    new Date(
      date.length === 10 ? date + "T00:00:00+07:00" : date,
    ).getTime();
  const abs = Math.max(0, ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "Vừa xong";
  if (abs < hour) return `${Math.floor(abs / minute)} phút trước`;
  if (abs < day) return `${Math.floor(abs / hour)} giờ trước`;
  if (abs < 2 * day) return "Hôm qua";
  if (abs < 7 * day) return `${Math.floor(abs / day)} ngày trước`;
  return dateLabel(date);
};

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
