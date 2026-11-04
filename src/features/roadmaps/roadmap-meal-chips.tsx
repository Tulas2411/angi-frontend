"use client";
import { mealSlots } from "./roadmap-add-item-rules";
import { mealSlotLabels } from "./roadmap-detail-rules";
import type { MealSlot } from "./roadmap-types";
import "./roadmap-pickers.css";

/**
 * The five meals as pills (roadmap-pickers.css). `multiple` uses checkboxes (several meals),
 * otherwise radios (one meal); either way each chip is named after its meal ("Bữa trưa").
 */
export function MealChips({
  name,
  multiple = false,
  selected,
  onToggle,
}: {
  name: string;
  multiple?: boolean;
  selected: readonly MealSlot[];
  /** A radio only ever reports `checked = true`. */
  onToggle: (slot: MealSlot, checked: boolean) => void;
}) {
  return (
    <div className="roadmap-meal-chips">
      {mealSlots.map((slot) => (
        <label key={slot} className="roadmap-meal-chip">
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={slot}
            checked={selected.includes(slot)}
            onChange={(event) => onToggle(slot, event.target.checked)}
            suppressHydrationWarning
          />
          <span>{mealSlotLabels[slot]}</span>
        </label>
      ))}
    </div>
  );
}
