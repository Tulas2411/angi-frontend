import { ApiError, getErrorMessage } from "@/shared/api/error";
import { dishFormLabels } from "@/features/owner/menu-rules";
import { money } from "@/shared/format";
import type {
  DishForm,
  MenuDishDto,
  MenuItemDto,
} from "@/features/owner/menu-types";
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
 * A dish as it was before the submission: the dish on sale (MOD-M2 `before`, while the submission
 * is pending) or the same dish in the previous approved submission (once this one is approved,
 * the dish on sale already holds the new values).
 */
export interface DishBefore {
  name: string;
  /** `undefined` when the source does not carry it, so it is not compared. */
  description?: string | null;
  price: number;
  dishForm: DishForm;
  coverUrl: string | null;
  /** Only in a submission item; a dish card is compared by `coverUrl`. */
  coverMediaId?: number | null;
  tagIds: number[];
  /** Names the source already carries (a dish card's tags). */
  tagNames?: ReadonlyMap<number, string>;
  /** Only in a submission item. */
  sortOrder?: number;
}

export const beforeFromDish = (dish: MenuDishDto): DishBefore => ({
  name: dish.name,
  description: dish.description,
  price: dish.price,
  dishForm: dish.dishForm,
  coverUrl: dish.coverUrl,
  tagIds: dish.tags.map((tag) => tag.id),
  tagNames: new Map(dish.tags.map((tag) => [tag.id, tag.name])),
});

export const beforeFromItem = (item: MenuItemDto): DishBefore => ({
  name: item.name,
  description: item.description,
  price: item.price,
  dishForm: item.dishForm,
  coverUrl: item.coverUrl,
  coverMediaId: item.coverMediaId,
  tagIds: item.tagIds,
  sortOrder: item.sortOrder,
});

const sameIds = (a: readonly number[], b: readonly number[]) =>
  [...a].sort((x, y) => x - y).join(",") ===
  [...b].sort((x, y) => x - y).join(",");

const coverChanged = (before: DishBefore, item: MenuItemDto) =>
  before.coverMediaId !== undefined
    ? (before.coverMediaId ?? null) !== (item.coverMediaId ?? null)
    : (before.coverUrl ?? "") !== (item.coverUrl ?? "");

/**
 * What an edited dish changes compared with `before`. Description and position are compared only
 * when `before` carries them.
 */
export function itemChanges(
  item: MenuItemDto,
  before: DishBefore | null,
  tagNames: ReadonlyMap<number, string>,
): FieldChange[] {
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
  if (
    before.description !== undefined &&
    (before.description ?? "").trim() !== (item.description ?? "").trim()
  )
    rows.push({
      label: "Mô tả",
      before: before.description?.trim() || "Không có",
      after: item.description?.trim() || "Không có",
    });
  if (!sameIds(before.tagIds, item.tagIds)) {
    const names = new Map([...tagNames, ...(before.tagNames ?? [])]);
    rows.push({
      label: "Thẻ",
      before: tagList(before.tagIds, names) || "Không có",
      after: tagList(item.tagIds, tagNames) || "Không có",
    });
  }
  if (coverChanged(before, item))
    rows.push({ label: "Ảnh món", before: "Ảnh cũ", after: "Ảnh mới" });
  if (before.sortOrder !== undefined && before.sortOrder !== item.sortOrder)
    rows.push({
      label: "Thứ tự",
      before: `Vị trí ${before.sortOrder}`,
      after: `Vị trí ${item.sortOrder}`,
    });
  return rows;
}

/** One submitted dish with the change and the earlier values the page shows for it. */
export interface ComparedItem {
  item: ModMenuItemDiffDto;
  change: MenuItemDto["change"];
  before: DishBefore | null;
}

/**
 * Same rule as the backend (`RestaurantMenuMapper.GetChange`): a kept dish is edited when its
 * name, description, form, price, photo, position or tags differ.
 */
const sameDish = (item: MenuItemDto, before: MenuItemDto) =>
  item.name === before.name &&
  (item.description ?? null) === (before.description ?? null) &&
  item.dishForm === before.dishForm &&
  Number(item.price) === Number(before.price) &&
  (item.coverMediaId ?? null) === (before.coverMediaId ?? null) &&
  item.sortOrder === before.sortOrder &&
  sameIds(item.tagIds, before.tagIds);

/**
 * The comparison the page shows. Without `baseline` it is MOD-M2 as sent (pending: compared with
 * the dish on sale). With `baseline` (the items of the previous approved submission) every kept
 * dish is compared with its values in that submission, which are the values the approval replaced.
 * A dish the baseline does not hold keeps what MOD-M2 sent.
 */
export function compareItems(
  items: readonly ModMenuItemDiffDto[],
  baseline: readonly MenuItemDto[] | null,
): ComparedItem[] {
  const byDish = new Map<number, MenuItemDto>();
  for (const entry of baseline ?? []) {
    const dishId = entry.resultDishId ?? entry.sourceDishId;
    if (dishId) byDish.set(dishId, entry);
  }
  return items.map((item) => {
    const previous =
      baseline && item.sourceDishId !== null
        ? byDish.get(item.sourceDishId)
        : undefined;
    if (previous)
      return {
        item,
        change: sameDish(item, previous) ? "unchanged" : "edited",
        before: beforeFromItem(previous),
      };
    return {
      item,
      change: item.change,
      before:
        item.change === "edited" && item.before
          ? beforeFromDish(item.before)
          : null,
    };
  });
}

/**
 * The approved submission of the same restaurant reviewed last before `current`: its items are the
 * menu that `current` replaced. `null` when there is none.
 */
export function previousApproved<
  T extends { id: number; status: string; reviewedAt: string | null },
>(cards: readonly T[], current: { id: number; reviewedAt: string | null }) {
  const at = current.reviewedAt ? Date.parse(current.reviewedAt) : NaN;
  if (Number.isNaN(at)) return null;
  let found: T | null = null;
  let foundAt = -Infinity;
  for (const card of cards) {
    if (card.id === current.id || card.status !== "approved") continue;
    const time = card.reviewedAt ? Date.parse(card.reviewedAt) : NaN;
    if (Number.isNaN(time) || time >= at || time <= foundAt) continue;
    found = card;
    foundAt = time;
  }
  return found;
}

/** Counts shown above the comparison; `unchanged` dishes stay as they are. */
export function itemCounts(
  items: readonly { change: MenuItemDto["change"] }[],
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
