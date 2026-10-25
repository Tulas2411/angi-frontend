import { ApiError, getErrorMessage } from "@/shared/api/error";

/** `already-gone`: RM-09 answered ROADMAP_ITEM_NOT_FOUND, so the item was removed elsewhere. */
export type RemoveOutcome = "removed" | "already-gone";

/** RM-09 failures by `errorCode`; `gone` means the item is no longer in the roadmap. */
export function removeItemError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "ROADMAP_ITEM_NOT_FOUND")
    return { gone: true, message: "Món này không còn trong lộ trình." };
  return { gone: false, message: getErrorMessage(error) };
}

/** What the traveler reads after the dialog closes. */
export function removeNotice(outcome: RemoveOutcome, dishName: string) {
  return outcome === "removed"
    ? `Đã xóa ${dishName} khỏi lộ trình.`
    : `${dishName} không còn trong lộ trình (có thể đã được xóa ở nơi khác). Danh sách đã được cập nhật.`;
}

/** The item is deleted but RM-03 could not be read again, so the screen may still show it. */
export const removeReloadFailed =
  "Món đã được xóa nhưng chưa tải lại được lộ trình. Hãy tải lại trang để xem đầy đủ.";
