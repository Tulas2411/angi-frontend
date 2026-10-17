import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  AddMenuItemDto,
  MenuItemDto,
  MenuItemValues,
  MenuStatus,
  PatchMenuItemDto,
} from "./menu-types";
export const menuStatusLabels: Record<MenuStatus, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  cancelled: "Đã hủy",
};
export const dishFormLabels = {
  soup: "Món nước",
  dry: "Món khô",
  other: "Khác",
};
export function menuItemValues(item?: MenuItemDto): MenuItemValues {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    dishForm: item?.dishForm ?? "soup",
    price: item ? String(item.price) : "",
    coverMediaId: item?.coverMediaId ?? null,
    coverUrl: item?.coverUrl ?? null,
    tagIds: [...(item?.tagIds ?? [])],
    sortOrder: item ? String(item.sortOrder) : "",
  };
}
const sameIds = (a: number[], b: number[]) =>
  [...a].sort((x, y) => x - y).join(",") ===
  [...b].sort((x, y) => x - y).join(",");
/** Only fields actually changed by the owner enter OWN-15; null only clears the cover. */
export function menuItemRequest(
  values: MenuItemValues,
  original?: MenuItemDto,
): PatchMenuItemDto {
  const body: PatchMenuItemDto = {};
  if (!original || values.name.trim() !== original.name)
    body.name = values.name.trim();
  if (!original || values.description.trim() !== (original.description ?? ""))
    body.description = values.description.trim();
  if (!original || values.dishForm !== original.dishForm)
    body.dishForm = values.dishForm;
  if (!original || Number(values.price) !== original.price)
    body.price = Number(values.price);
  if (values.coverMediaId !== (original?.coverMediaId ?? null))
    body.coverMediaId = values.coverMediaId;
  if (!original || !sameIds(values.tagIds, original.tagIds))
    body.tagIds = [...values.tagIds];
  if (
    values.sortOrder !== "" &&
    (!original || Number(values.sortOrder) !== original.sortOrder)
  )
    body.sortOrder = Number(values.sortOrder);
  return body;
}
export function validateMenuItem(
  values: MenuItemValues,
  original?: MenuItemDto,
) {
  const errors: Record<string, string> = {};
  const body = menuItemRequest(values, original);
  if (body.name !== undefined && (!body.name || body.name.length > 200))
    errors.name = "Tên món phải từ 1 đến 200 ký tự.";
  if (
    body.description !== undefined &&
    (body.description.length < 30 || body.description.length > 2000)
  )
    errors.description = "Mô tả phải từ 30 đến 2000 ký tự.";
  if (
    body.dishForm !== undefined &&
    !["soup", "dry", "other"].includes(body.dishForm)
  )
    errors.dishForm = "Vui lòng chọn loại món hợp lệ.";
  if (
    !values.price.trim() ||
    !Number.isSafeInteger(Number(values.price)) ||
    Number(values.price) < 0 ||
    Number(values.price) > 999999999999
  )
    errors.price = "Giá phải là số nguyên VND từ 0 đến 999.999.999.999.";
  if (
    (original && !values.sortOrder.trim()) ||
    (values.sortOrder !== "" &&
      (!Number.isInteger(Number(values.sortOrder)) ||
        Number(values.sortOrder) < 0 ||
        Number(values.sortOrder) > 32767))
  )
    errors.sortOrder = "Thứ tự phải là số nguyên từ 0 đến 32767.";
  if (
    values.coverMediaId !== null &&
    (!Number.isSafeInteger(values.coverMediaId) || values.coverMediaId <= 0)
  )
    errors.coverMediaId = "Ảnh món không hợp lệ.";
  if (
    values.tagIds.some(
      (id) => !Number.isInteger(id) || id <= 0 || id > 32767,
    ) ||
    new Set(values.tagIds).size !== values.tagIds.length
  )
    errors.tagIds = "Tag phải có mã dương, không trùng nhau.";
  return errors;
}
export function newMenuItemRequest(values: MenuItemValues): AddMenuItemDto {
  return {
    ...menuItemRequest(values),
    name: values.name.trim(),
    description: values.description.trim(),
    dishForm: values.dishForm,
    price: Number(values.price),
  };
}
export function menuFieldErrors(error: unknown) {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(
    Object.entries(error.errors ?? {}).map(([key, messages]) => [
      key.charAt(0).toLowerCase() + key.slice(1),
      messages.join(" "),
    ]),
  );
}
export function openMenuId(error: unknown): number | null {
  if (
    !(error instanceof ApiError) ||
    error.errorCode !== "SUBMISSION_ALREADY_OPEN" ||
    !error.data ||
    typeof error.data !== "object" ||
    !("id" in error.data)
  )
    return null;
  const id = error.data.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}
export function menuErrorMessage(error: unknown) {
  const messages: Record<string, string> = {
    RESTAURANT_NOT_FOUND: "Bạn chưa đăng ký nhà hàng.",
    RESTAURANT_NOT_VERIFIED:
      "Nhà hàng cần được xác minh trước khi tạo bản nháp thực đơn.",
    SUBMISSION_ALREADY_OPEN:
      "Bạn đã có một bản nháp hoặc thực đơn đang chờ duyệt. Hãy mở bản hiện có.",
    SUBMISSION_NOT_EDITABLE:
      "Bản thực đơn không còn ở trạng thái nháp. Tải lại để xem trạng thái mới nhất.",
    SUBMISSION_NOT_CANCELLABLE:
      "Bản thực đơn này không còn có thể hủy. Tải lại để xem trạng thái mới nhất.",
    SUBMISSION_NOT_FOUND:
      "Không tìm thấy bản thực đơn của bạn. Hãy tải lại danh sách.",
    SUBMISSION_ITEM_NOT_FOUND:
      "Món trong bản nháp không còn tồn tại. Hãy tải lại bản thực đơn.",
    DISH_NOT_FOUND:
      "Không tìm thấy món trong thực đơn đang bán. Hãy tải lại danh sách.",
  };
  return error instanceof ApiError
    ? (messages[error.errorCode] ?? getErrorMessage(error))
    : getErrorMessage(error);
}
