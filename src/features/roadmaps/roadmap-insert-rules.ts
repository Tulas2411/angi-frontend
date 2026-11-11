import { sortItems, type ItemPatch } from "./roadmap-reorder-rules";
import type { MealSlot, RoadmapItemDto } from "./roadmap-types";

/**
 * Where a new dish goes inside its meal: the start, after one of the dishes already there, or
 * the end (RM-07's default when `sortOrder` is left out).
 */
export type PositionChoice = "end" | "start" | `after:${number}`;

export interface PositionOption {
  value: PositionChoice;
  label: string;
}

function mealItems(items: readonly RoadmapItemDto[], mealSlot: MealSlot) {
  return sortItems(items).filter((item) => item.mealSlot === mealSlot);
}

/**
 * The places offered for a meal of a day, in the order they appear on the page: start, after each
 * dish but the last (that one is "end"), end. A meal without dishes has only "end".
 */
export function positionOptions(
  items: readonly RoadmapItemDto[],
  mealSlot: MealSlot,
): PositionOption[] {
  const group = mealItems(items, mealSlot);
  if (!group.length) return [{ value: "end", label: "Cuối bữa" }];
  return [
    { value: "start", label: "Đầu bữa" },
    ...group.slice(0, -1).map((item) => ({
      value: `after:${item.id}` as const,
      label: `Sau ${item.dish.name}`,
    })),
    { value: "end", label: "Cuối bữa" },
  ];
}

/** A choice that is no longer on offer (the dish it followed was removed) falls back to the end. */
export function resolvePosition(
  choice: PositionChoice,
  options: readonly PositionOption[],
): PositionChoice {
  return options.some((option) => option.value === choice) ? choice : "end";
}

/**
 * What it takes to put a new dish at `choice`. The backend gives the new item exactly the
 * `sortOrder` it is sent and never shifts its neighbours (RM-07, RM-08), so the dishes from that
 * place on are moved one step later first (`patches`, RM-08), then the dish is added with
 * `sortOrder` (RM-07). Leaving `sortOrder` out appends to the end of the meal, which needs no shift.
 */
export function planInsert(
  items: readonly RoadmapItemDto[],
  mealSlot: MealSlot,
  choice: PositionChoice,
): { sortOrder?: number; patches: ItemPatch[] } {
  const group = mealItems(items, mealSlot);
  const index =
    choice === "start"
      ? 0
      : choice === "end"
        ? group.length
        : group.findIndex((item) => item.id === Number(choice.slice(6))) + 1 ||
          group.length;
  if (index >= group.length) return { patches: [] };
  const patches: ItemPatch[] = [];
  group.forEach((item, position) => {
    const next = position < index ? position : position + 1;
    if (item.sortOrder !== next)
      patches.push({ itemId: item.id, sortOrder: next });
  });
  // The dishes furthest down move first, so no two dishes ever share a place half-way through.
  patches.sort((a, b) => b.sortOrder - a.sortOrder);
  return { sortOrder: index, patches };
}

/** Maps link for a place; none when the restaurant has no coordinates. */
export function restaurantMapsUrl(restaurant: {
  latitude: number | null;
  longitude: number | null;
}) {
  if (restaurant.latitude === null || restaurant.longitude === null)
    return null;
  return `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;
}
