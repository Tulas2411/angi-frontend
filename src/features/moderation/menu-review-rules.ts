import { ApiError, getErrorMessage } from "@/shared/api/error";
import { dishFormLabels } from "@/features/owner/menu-rules";
import { money } from "@/shared/format";
import type { MenuQueueStatus, ModMenuItemDiffDto } from "./menu-review-types";

export const menuQueueTabs: { value: MenuQueueStatus; label: string }[] = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
];

export const menuStatusTone = (
  status: string,
): "success" | "warning" | "error" | "neutral" =>
  status === "approved"
    ? "success"
    : status === "rejected"
      ? "error"
      : status === "pending"
        ? "warning"
        : "neutral";

/** BE limit of `reviewNote` (Approve/RejectMenuSubmissionRequestDtoValidator). */
export const menuNoteMax = 1000;

export type MenuDecision = "approve" | "reject";

/** The reason is required to reject; any note is at most 1000 characters. */
export function menuDecisionProblem(decision: MenuDecision, note: string) {
  const text = note.trim();
  if (decision === "reject" && !text)
    return "Ghi lý do từ chối để chủ quán biết cần sửa món nào.";
  if (text.length > menuNoteMax)
    return `Ghi chú không được vượt quá ${menuNoteMax} ký tự.`;
  return "";
}

export type ItemFilter = "all" | "new" | "edited" | "removed" | "unchanged";

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

const tagList = (ids: readonly number[], names: ReadonlyMap<number, string>) =>
  ids
    .map((id) => names.get(id) ?? `#${id}`)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .join(", ");

/**
 * What an edited dish changes, compared with the dish on sale (`before`). The running dish has no
 * description in its card, so a description is shown as submitted, not compared.
 */
export function itemChanges(
  item: ModMenuItemDiffDto,
  tagNames: ReadonlyMap<number, string>,
): FieldChange[] {
  const before = item.before;
  if (!before) return [];
  const rows: FieldChange[] = [];
  if (before.name.trim() !== item.name.trim())
    rows.push({ label: "Tên món", before: before.name, after: item.name });
  if (Number(before.price) !== Number(item.price))
    rows.push({
      label: "Giá",
      before: money(before.price),
      after: money(item.price),
    });
  if (before.dishForm !== item.dishForm)
    rows.push({
      label: "Loại món",
      before: dishFormLabels[before.dishForm],
      after: dishFormLabels[item.dishForm],
    });
  const beforeTags = tagList(
    before.tags.map((tag) => tag.id),
    new Map(before.tags.map((tag) => [tag.id, tag.name])),
  );
  const afterTags = tagList(item.tagIds, tagNames);
  if (
    [...before.tags.map((tag) => tag.id)].sort().join(",") !==
    [...item.tagIds].sort().join(",")
  )
    rows.push({
      label: "Thẻ",
      before: beforeTags || "Không có",
      after: afterTags || "Không có",
    });
  if ((before.coverUrl ?? "") !== (item.coverUrl ?? ""))
    rows.push({ label: "Ảnh món", before: "Ảnh cũ", after: "Ảnh mới" });
  return rows;
}

/** Counts shown above the comparison; `unchanged` dishes stay as they are. */
export function itemCounts(
  items: readonly ModMenuItemDiffDto[],
  removed: number,
) {
  return {
    all: items.length + removed,
    new: items.filter((item) => item.change === "new").length,
    edited: items.filter((item) => item.change === "edited").length,
    unchanged: items.filter((item) => item.change === "unchanged").length,
    removed,
  };
}

export const tagNamesOf = (
  tags: readonly { id: number; name: string }[],
): ReadonlyMap<number, string> =>
  new Map(tags.map((tag) => [tag.id, tag.name]));

/** MOD-M1..MOD-M4 failures by `errorCode` (sheet "Mã lỗi"). */
export function menuReviewError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "SUBMISSION_NOT_FOUND")
    return "Không tìm thấy bản thực đơn này.";
  if (code === "SUBMISSION_NOT_PENDING")
    return "Bản thực đơn này không còn chờ duyệt (đã được xử lý hoặc chủ quán đã rút lại). Trang đã tải lại kết quả mới nhất.";
  if (code === "VALIDATION_FAILED")
    return "Thông tin chưa hợp lệ: lý do là bắt buộc khi từ chối, tối đa 1000 ký tự.";
  if (code === "FORBIDDEN") return "Chỉ kiểm duyệt viên được duyệt thực đơn.";
  return getErrorMessage(error);
}
