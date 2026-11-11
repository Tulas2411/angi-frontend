import { ApiError, getErrorMessage } from "@/shared/api/error";
import { mealSlots } from "./roadmap-add-item-rules";
import { mealSlotLabels } from "./roadmap-detail-rules";
import type {
  MealSlot,
  RoadmapItemDto,
  UpdateRoadmapItemRequestDto,
} from "./roadmap-types";

/**
 * Where an item is dropped: a meal of the same day and a position inside it, counted without
 * the item itself (0 = first dish of the meal).
 */
export interface MoveTarget {
  mealSlot: MealSlot;
  index: number;
}

/** One RM-08 call: the item's new meal (only when it changed) and its new `sortOrder`. */
export interface ItemPatch {
  itemId: number;
  mealSlot?: MealSlot;
  sortOrder: number;
}

const mealRank = (slot: MealSlot) => mealSlots.indexOf(slot);

/** RM-03 order: meal in day order, then `sortOrder`, then id (the backend's own tie-break). */
export function sortItems(items: readonly RoadmapItemDto[]) {
  return [...items].sort(
    (a, b) =>
      mealRank(a.mealSlot) - mealRank(b.mealSlot) ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );
}

function mealItems(items: readonly RoadmapItemDto[], slot: MealSlot) {
  return sortItems(items).filter((item) => item.mealSlot === slot);
}

/** The meals that have dishes, in day order. */
export function activeMeals(items: readonly RoadmapItemDto[]): MealSlot[] {
  return mealSlots.filter((slot) =>
    items.some((item) => item.mealSlot === slot),
  );
}

/**
 * RM-08 calls that put `itemId` at `target`. The backend changes only the item it is told to
 * change and never shifts its neighbours, so every dish of the target meal whose position
 * changed gets its new `sortOrder` (0, 1, 2…), which also settles ties left by earlier
 * generations. Empty when the dish is already there.
 */
export function planMove(
  items: readonly RoadmapItemDto[],
  itemId: number,
  target: MoveTarget,
): ItemPatch[] {
  const moved = items.find((item) => item.id === itemId);
  if (!moved) return [];
  const others = mealItems(items, target.mealSlot).filter(
    (item) => item.id !== itemId,
  );
  const index = Math.max(0, Math.min(target.index, others.length));
  if (moved.mealSlot === target.mealSlot) {
    const current = mealItems(items, moved.mealSlot).findIndex(
      (item) => item.id === itemId,
    );
    if (current === index) return [];
  }
  const order = [...others.slice(0, index), moved, ...others.slice(index)];
  const patches: ItemPatch[] = [];
  order.forEach((item, position) => {
    const mealChanged = item.id === itemId && item.mealSlot !== target.mealSlot;
    if (!mealChanged && item.sortOrder === position) return;
    patches.push({
      itemId: item.id,
      ...(mealChanged ? { mealSlot: target.mealSlot } : {}),
      sortOrder: position,
    });
  });
  // The dish the traveler moved goes first, so a failure leaves it where they put it.
  return patches.sort(
    (a, b) => Number(b.itemId === itemId) - Number(a.itemId === itemId),
  );
}

/** The day as it will look once the patches are saved, for the screen to show at once. */
export function applyPatches(
  items: readonly RoadmapItemDto[],
  patches: readonly ItemPatch[],
) {
  const byId = new Map(patches.map((patch) => [patch.itemId, patch]));
  return sortItems(
    items.map((item) => {
      const patch = byId.get(item.id);
      return patch
        ? {
            ...item,
            mealSlot: patch.mealSlot ?? item.mealSlot,
            sortOrder: patch.sortOrder,
          }
        : item;
    }),
  );
}

/**
 * The keyboard step: one place up or down. Past the first or last dish of a meal it goes to the
 * neighbouring meal (and so changes the meal, as a drag across meals does); `null` at the ends.
 */
export function stepTarget(
  items: readonly RoadmapItemDto[],
  itemId: number,
  direction: -1 | 1,
): MoveTarget | null {
  const moved = items.find((item) => item.id === itemId);
  if (!moved) return null;
  const group = mealItems(items, moved.mealSlot);
  const position = group.findIndex((item) => item.id === itemId);
  const next = position + direction;
  if (next >= 0 && next < group.length)
    return { mealSlot: moved.mealSlot, index: next };
  const meals = activeMeals(items);
  const neighbour = meals[meals.indexOf(moved.mealSlot) + direction];
  if (!neighbour) return null;
  return {
    mealSlot: neighbour,
    index: direction === -1 ? mealItems(items, neighbour).length : 0,
  };
}

/** RM-08 body of one patch: only the fields that change. */
export function patchBody(patch: ItemPatch): UpdateRoadmapItemRequestDto {
  return {
    ...(patch.mealSlot ? { mealSlot: patch.mealSlot } : {}),
    sortOrder: patch.sortOrder,
  };
}

/** What a screen reader hears after a move, e.g. "Đã chuyển Bún bò Huế lên vị trí 1 của bữa sáng." */
export function moveAnnouncement(
  items: readonly RoadmapItemDto[],
  itemId: number,
  target: MoveTarget,
) {
  const moved = items.find((item) => item.id === itemId);
  if (!moved) return "";
  const meal = mealSlotLabels[target.mealSlot].toLowerCase();
  const count = mealItems(items, target.mealSlot).filter(
    (item) => item.id !== itemId,
  ).length;
  const position = Math.min(target.index, count) + 1;
  return `Đã chuyển ${moved.dish.name} tới vị trí ${position} của ${meal}.`;
}

/** RM-08 failures by `errorCode`; the screen reads the roadmap again either way. */
export function moveItemError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "ROADMAP_ITEM_NOT_FOUND")
    return "Món này không còn trong lộ trình nên chưa đổi được thứ tự. Danh sách đã được cập nhật.";
  return `Chưa lưu được thứ tự mới: ${getErrorMessage(error)} Danh sách đã được tải lại.`;
}

/** The reload after the move failed too, so the screen may show a stale order. */
export const moveReloadFailed =
  "Chưa lưu được thứ tự mới và cũng chưa tải lại được lộ trình. Hãy tải lại trang để xem đúng thứ tự.";
