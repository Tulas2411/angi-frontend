"use client";
import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { Icon } from "@/components/ui/primitives";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";
import {
  travelModeOf,
  travelModes,
  type TravelMode,
} from "./roadmap-detail-rules";

/**
 * The means of travel of one leg: its icon is a button that opens the three choices (Xe máy,
 * ô tô / Xe đạp / Đi bộ). Picking one closes the list; the leg and the day total are worked out
 * again by the itinerary.
 */
export function LegModePicker({
  mode,
  endpoints,
  onChange,
}: {
  mode: TravelMode;
  /** "Phở tái chín → Bánh xèo", for the button's name. */
  endpoints: string;
  onChange: (mode: TravelMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = travelModeOf(mode);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="roadmap-leg-mode"
          aria-label={`Phương tiện chặng ${endpoints}: ${current.label}. Đổi phương tiện`}
        >
          <Icon name={current.icon} />
          <ChevronDownIcon className="roadmap-leg-mode-caret" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="roadmap-leg-modes"
        aria-label="Chọn phương tiện"
      >
        <ul role="list">
          {travelModes.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                aria-pressed={entry.id === mode}
                onClick={() => {
                  setOpen(false);
                  if (entry.id !== mode) onChange(entry.id);
                }}
              >
                <Icon name={entry.icon} />
                <span>{entry.label}</span>
                {entry.id === mode && (
                  <CheckIcon className="roadmap-leg-modes-check" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
