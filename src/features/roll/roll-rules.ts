import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  BrowseDishesQuery,
  DishCardDto,
  TagDto,
} from "@/features/explore/explore-types";
import type { RollDishRequestDto } from "./roll-service";

/** DISH-03 accepts at most 50 dishes to leave out. */
export const maxExcludedDishes = 50;
/** Cards on the spinning strip (the design shows five). */
export const stripSize = 5;

export type RollTab = "viet" | "light" | "vegetarian" | "budget";

export const rollTabs: { value: RollTab; label: string }[] = [
  { value: "viet", label: "✓ Món Việt" },
  { value: "light", label: "Ăn nhẹ" },
  { value: "vegetarian", label: "Ăn chay" },
  { value: "budget", label: "✓ Dưới 50k" },
];

/** The dietary tag of vegetarian dishes; its code is data, so it is found by name. */
export function vegetarianTag(tags: readonly TagDto[]) {
  return tags.find(
    (tag) =>
      tag.tagType === "dietary" &&
      /chay|vegetarian|vegan/i.test(`${tag.code} ${tag.name}`),
  );
}

function snackTag(tags: readonly TagDto[]) {
  return tags.find(
    (tag) => tag.tagType === "meal_time" && tag.code === "snack",
  );
}

/**
 * What a tab asks for: the DISH-03 body and the DISH-01 query of the strip. "Món Việt" is every
 * dish on ANGI; "Ăn nhẹ" is the snack meal time; "Dưới 50k" is the price. `null` when the tab
 * needs a tag the catalog does not have.
 */
export function tabConditions(
  tab: RollTab,
  tags: readonly TagDto[],
): { roll: RollDishRequestDto; strip: BrowseDishesQuery } | null {
  const strip: BrowseDishesQuery = { limit: stripSize + 3 };
  if (tab === "budget")
    return { roll: { maxPrice: 50000 }, strip: { ...strip, maxPrice: 50000 } };
  if (tab === "light") {
    const snack = snackTag(tags);
    return {
      roll: { mealTime: "snack" },
      strip: snack ? { ...strip, tagIds: [snack.id] } : strip,
    };
  }
  if (tab === "vegetarian") {
    const tag = vegetarianTag(tags);
    return tag
      ? { roll: { tagIds: [tag.id] }, strip: { ...strip, tagIds: [tag.id] } }
      : null;
  }
  return { roll: {}, strip };
}

/** The tab's body with the dishes already shown in this series (the last 50). */
export function rollRequest(
  conditions: RollDishRequestDto,
  shown: readonly number[],
): RollDishRequestDto {
  return shown.length
    ? { ...conditions, excludeDishIds: shown.slice(-maxExcludedDishes) }
    : { ...conditions };
}

/**
 * The revealed row: the rolled dish in the middle (third of five, under the marker), the
 * strip's other dishes around it.
 */
export function revealedCards<T extends Pick<DishCardDto, "id">>(
  strip: readonly T[],
  rolled: T,
): { cards: T[]; selected: number } {
  const others = strip
    .filter((dish) => dish.id !== rolled.id)
    .slice(0, stripSize - 1);
  const selected = Math.min(2, others.length);
  const cards = [...others];
  cards.splice(selected, 0, rolled);
  return { cards, selected };
}

/** A failed roll in words; `exhausted` asks the visitor to change the tab or start over. */
export function rollError(error: unknown): {
  message: string;
  exhausted: boolean;
} {
  if (error instanceof ApiError && error.errorCode === "NO_CANDIDATE")
    return {
      exhausted: true,
      message:
        "Không còn món nào hợp lựa chọn này. Hãy đổi lựa chọn hoặc roll lại từ đầu.",
    };
  return { exhausted: false, message: getErrorMessage(error) };
}
