import type {
  OperatingStatus,
  UpdateOperatingStatusRequestDto,
} from "./restaurant-types";

export const operatingStatuses = [
  "open",
  "temporarily_closed",
  "permanently_closed",
] as const;
export const operatingStatusLabels: Record<OperatingStatus, string> = {
  open: "Đang hoạt động",
  temporarily_closed: "Tạm đóng",
  permanently_closed: "Đóng cửa vĩnh viễn",
};

export function isOperatingStatus(value: string): value is OperatingStatus {
  return operatingStatuses.some((status) => status === value);
}

export function validateOperatingStatus(
  status: string,
  note: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isOperatingStatus(status))
    errors.operatingStatus = "Chọn trạng thái hoạt động hợp lệ.";
  if (note.length > 500) errors.note = "Lý do không được vượt quá 500 ký tự.";
  return errors;
}

export function buildOperatingStatusRequest(
  status: OperatingStatus,
  note: string,
): UpdateOperatingStatusRequestDto {
  const reason = note.trim();
  return { operatingStatus: status, ...(reason ? { note: reason } : {}) };
}

export function operatingStatusFieldErrors(
  errors?: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([key, messages]) => [
      key
        .replace(/^OperatingStatus$/i, "operatingStatus")
        .replace(/^Note$/i, "note"),
      messages.join(" "),
    ]),
  );
}
