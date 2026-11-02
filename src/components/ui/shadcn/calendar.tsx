"use client";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { vi } from "react-day-picker/locale";
import { useReducedMotion } from "./use-reduced-motion";
import { cn } from "./utils";
import "./shadcn.css";

/**
 * shadcn/ui Calendar (react-day-picker v9) in Vietnamese, weeks starting on Monday, with rounded
 * days and the ANGI accent on the chosen day.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: ComponentProps<typeof DayPicker>) {
  const reduced = useReducedMotion();
  return (
    <DayPicker
      locale={vi}
      weekStartsOn={1}
      // Always six weeks: a month that needs six rows (e.g. 11/2026) would otherwise make the
      // popover taller and flip it above the field when the month changes.
      fixedWeeks
      // The month slides in from the side it comes from, unless less motion was asked for.
      animate={!reduced}
      showOutsideDays={showOutsideDays}
      className={cn("ui-calendar", className)}
      classNames={{
        months: "ui-calendar-months",
        month: "ui-calendar-month",
        month_caption: "ui-calendar-caption",
        caption_label: "ui-calendar-caption-label",
        nav: "ui-calendar-nav",
        button_previous: "ui-calendar-nav-button",
        button_next: "ui-calendar-nav-button",
        month_grid: "ui-calendar-grid",
        weekdays: "ui-calendar-weekdays",
        weekday: "ui-calendar-weekday",
        week: "ui-calendar-week",
        day: "ui-calendar-day",
        day_button: "ui-calendar-day-button",
        selected: "is-selected",
        today: "is-today",
        outside: "is-outside",
        disabled: "is-disabled",
        hidden: "is-hidden",
        weeks_before_enter: "ui-calendar-in-from-left",
        weeks_before_exit: "ui-calendar-out-to-left",
        weeks_after_enter: "ui-calendar-in-from-right",
        weeks_after_exit: "ui-calendar-out-to-right",
        caption_before_enter: "ui-calendar-fade-in",
        caption_before_exit: "ui-calendar-fade-out",
        caption_after_enter: "ui-calendar-fade-in",
        caption_after_exit: "ui-calendar-fade-out",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d={orientation === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"}
            />
          </svg>
        ),
      }}
      {...props}
    />
  );
}
