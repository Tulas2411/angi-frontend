import type { MenuDetailDto, SubmitMenuRequestDto } from "./menu-types";

/** OWN-13 supplies the comparison; availability alone is not a proposed menu change. */
export function menuApprovalIssue(
  detail: MenuDetailDto,
): "MENU_EMPTY" | "MENU_UNCHANGED" | null {
  if (!detail.items.length) return "MENU_EMPTY";
  if (
    !detail.removedDishes.length &&
    detail.items.every((item) => item.change === "unchanged")
  )
    return "MENU_UNCHANGED";
  return null;
}
/** The backend validates the untrimmed maximum length before normalizing whitespace. */
export function validateMenuOwnerNote(note: string): string | undefined {
  return note.length > 1000
    ? "Ghi chú gửi kiểm duyệt không được vượt quá 1000 ký tự."
    : undefined;
}
export function menuApprovalRequest(note: string): SubmitMenuRequestDto {
  const ownerNote = note.trim();
  return ownerNote ? { ownerNote } : {};
}
