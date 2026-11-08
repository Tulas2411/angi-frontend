"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Calendar } from "@/components/ui/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";
import {
  dateInRange,
  dateToIso,
  isoToDate,
  isoToDisplay,
  parseTypedDate,
  parseTypedTime,
  pickerHours,
  pickerMinutes,
} from "./date-time-rules";

interface PickerInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Accessible name when no visible label points at the input. */
  ariaLabel?: string;
  pickerLabel: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * The typed text follows the value: a new value from outside (a reset, a pick) rewrites it, while a
 * half-typed entry stays until it is a real date or time.
 */
function useTypedText(value: string, display: (value: string) => string) {
  const [text, setText] = useState(display(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(display(value));
  }
  return [text, setText] as const;
}

const calendarIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const clockIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

/**
 * Pickers open below their field. When the bottom of the window (or of the open dialog) leaves too
 * little room, the page scrolls just enough to show the whole picker. A field pinned to the bottom
 * of a fixed panel, which no scroll can lift, opens its picker above instead (`pickerSide`).
 */
function useRoomBelow(open: boolean) {
  const anchor = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const panel = content.current?.getBoundingClientRect();
      if (!panel || !anchor.current) return;
      const dialog = anchor.current.closest("dialog");
      const bottom = dialog
        ? dialog.getBoundingClientRect().bottom
        : window.innerHeight;
      const missing = panel.bottom + 16 - bottom;
      if (missing <= 0) return;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      (dialog ?? window).scrollBy({ top: missing, behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return [anchor, content] as const;
}

/** A day: typed as dd/mm/yyyy, or picked on the shadcn Calendar in a rounded popover. */
function DatePickerInput({
  min,
  max,
  side = "bottom",
  ...props
}: PickerInputProps & {
  min?: string;
  max?: string;
  side?: "top" | "bottom";
}) {
  const { id, value, onChange } = props;
  const [open, setOpen] = useState(false);
  const [text, setText] = useTypedText(value, isoToDisplay);
  const [roomAnchor, roomContent] = useRoomBelow(open && side === "bottom");
  const selected = isoToDate(value) ?? undefined;
  const minDate = min ? (isoToDate(min) ?? undefined) : undefined;
  const maxDate = max ? (isoToDate(max) ?? undefined) : undefined;
  const today = new Date();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="ui-picker-input" ref={roomAnchor}>
        <input
          className="input"
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={props.placeholder ?? "dd/mm/yyyy"}
          aria-label={props.ariaLabel}
          required={props.required}
          disabled={props.disabled}
          aria-invalid={props.invalid}
          aria-describedby={props.describedBy}
          value={text}
          onChange={(event) => {
            const typed = event.target.value;
            setText(typed);
            if (!typed.trim()) return onChange("");
            const day = parseTypedDate(typed);
            if (day && dateInRange(day, min, max)) onChange(day);
          }}
          onBlur={() => setText(isoToDisplay(value))}
          suppressHydrationWarning
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            className="ui-picker-button"
            aria-label={props.pickerLabel}
            disabled={props.disabled}
            suppressHydrationWarning
          >
            {calendarIcon}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        ref={roomContent}
        side={side}
        // Below, the page scrolls to make room (useRoomBelow). Above, in a fixed panel nothing can
        // scroll, so the calendar slides sideways to stay on screen instead.
        avoidCollisions={side === "top"}
        collisionPadding={8}
        aria-label={props.pickerLabel}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? today}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          onSelect={(day) => {
            if (!day) return;
            onChange(dateToIso(day));
            setOpen(false);
          }}
        />
        <div className="ui-picker-footer">
          <button
            type="button"
            className="ui-picker-link"
            disabled={!dateInRange(dateToIso(today), min, max)}
            onClick={() => {
              onChange(dateToIso(today));
              setOpen(false);
            }}
          >
            Hôm nay
          </button>
          {!props.required && (
            <button
              type="button"
              className="ui-picker-link"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Xóa
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A time of day: typed as HH:mm, or picked from rounded hour and minute columns. */
function TimePickerInput(props: PickerInputProps) {
  const { id, value, onChange } = props;
  const [open, setOpen] = useState(false);
  const [text, setText] = useTypedText(value, (time) => time);
  const [roomAnchor, roomContent] = useRoomBelow(open);
  const [hour = "", minute = ""] = value.split(":");
  const minutes =
    minute && !pickerMinutes.includes(minute)
      ? [...pickerMinutes, minute].sort()
      : pickerMinutes;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="ui-picker-input" ref={roomAnchor}>
        <input
          className="input"
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={props.placeholder ?? "HH:mm"}
          aria-label={props.ariaLabel}
          required={props.required}
          disabled={props.disabled}
          aria-invalid={props.invalid}
          aria-describedby={props.describedBy}
          value={text}
          onChange={(event) => {
            const typed = event.target.value;
            setText(typed);
            if (!typed.trim()) return onChange("");
            const time = parseTypedTime(typed);
            if (time) onChange(time);
          }}
          onBlur={() => setText(value)}
          suppressHydrationWarning
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            className="ui-picker-button"
            aria-label={props.pickerLabel}
            disabled={props.disabled}
            suppressHydrationWarning
          >
            {clockIcon}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        ref={roomContent}
        side="bottom"
        avoidCollisions={false}
        className="ui-time-content"
        aria-label={props.pickerLabel}
      >
        <div className="ui-time-columns">
          <div className="ui-time-column" role="group" aria-label="Giờ">
            {pickerHours.map((option) => (
              <button
                key={option}
                type="button"
                className="ui-time-option"
                aria-pressed={option === hour}
                onClick={() => onChange(`${option}:${minute || "00"}`)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="ui-time-column" role="group" aria-label="Phút">
            {minutes.map((option) => (
              <button
                key={option}
                type="button"
                className="ui-time-option"
                aria-pressed={option === minute}
                onClick={() => {
                  onChange(`${hour || "00"}:${option}`);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FieldShell {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Submits the ISO value with a form, like the native input did. */
  name?: string;
  id?: string;
}

/** Controlled when `value` is given, otherwise it keeps its own value from `defaultValue`. */
function useFieldValue(
  value: string | undefined,
  defaultValue: string | undefined,
  onChange: ((value: string) => void) | undefined,
) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const current = value ?? own;
  const change = (next: string) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  return [current, change] as const;
}

function FieldFrame({
  shell,
  id,
  current,
  children,
}: {
  shell: FieldShell;
  id: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {shell.label}
        {shell.required && " *"}
      </label>
      {children}
      {shell.name && <input type="hidden" name={shell.name} value={current} />}
      <p className={shell.error ? "field-error" : "helper"} id={`${id}-help`}>
        {shell.error || shell.helper}
      </p>
    </div>
  );
}

/** A labelled day field (`yyyy-mm-dd`) with the shadcn date picker. */
export function DateField({
  value,
  defaultValue,
  onChange,
  min,
  max,
  pickerSide = "bottom",
  ...shell
}: FieldShell & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  /** "top" for a field at the foot of a fixed panel, where nothing can scroll the picker into view. */
  pickerSide?: "top" | "bottom";
}) {
  const generated = useId();
  const id = shell.id ?? generated;
  const [current, change] = useFieldValue(value, defaultValue, onChange);
  return (
    <FieldFrame shell={shell} id={id} current={current}>
      <DatePickerInput
        id={id}
        value={current}
        onChange={change}
        min={min}
        max={max}
        side={pickerSide}
        pickerLabel={`Chọn ngày: ${shell.label}`}
        placeholder={shell.placeholder}
        required={shell.required}
        disabled={shell.disabled}
        invalid={!!shell.error}
        describedBy={shell.helper || shell.error ? `${id}-help` : undefined}
      />
    </FieldFrame>
  );
}

/** A labelled time field (`HH:mm`) with the rounded hour and minute picker. */
export function TimeField({
  value,
  defaultValue,
  onChange,
  ...shell
}: FieldShell & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const generated = useId();
  const id = shell.id ?? generated;
  const [current, change] = useFieldValue(value, defaultValue, onChange);
  return (
    <FieldFrame shell={shell} id={id} current={current}>
      <TimePickerInput
        id={id}
        value={current}
        onChange={change}
        pickerLabel={`Chọn giờ: ${shell.label}`}
        placeholder={shell.placeholder}
        required={shell.required}
        disabled={shell.disabled}
        invalid={!!shell.error}
        describedBy={shell.helper || shell.error ? `${id}-help` : undefined}
      />
    </FieldFrame>
  );
}

/**
 * A labelled moment (`yyyy-mm-ddTHH:mm`, local time, like `datetime-local`): a day and a time side
 * by side. The value is complete only when both are set; until then it is empty.
 */
export function DateTimeField({
  value,
  defaultValue,
  onChange,
  min,
  ...shell
}: FieldShell & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** The earliest day (`yyyy-mm-dd` or the day of a `yyyy-mm-ddTHH:mm`). */
  min?: string;
}) {
  const generated = useId();
  const id = shell.id ?? generated;
  const [current, change] = useFieldValue(value, defaultValue, onChange);
  const [day = "", time = ""] = current.split("T");
  const [draft, setDraft] = useState({ day, time });
  const parts = current ? { day, time } : draft;
  const update = (next: { day: string; time: string }) => {
    setDraft(next);
    change(next.day && next.time ? `${next.day}T${next.time}` : "");
  };
  const describedBy = shell.helper || shell.error ? `${id}-help` : undefined;
  return (
    <FieldFrame shell={shell} id={id} current={current}>
      <div className="ui-datetime">
        <DatePickerInput
          id={id}
          value={parts.day}
          onChange={(next) => update({ ...parts, day: next })}
          min={min?.slice(0, 10)}
          pickerLabel={`Chọn ngày: ${shell.label}`}
          required={shell.required}
          disabled={shell.disabled}
          invalid={!!shell.error}
          describedBy={describedBy}
        />
        <TimePickerInput
          id={`${id}-time`}
          value={parts.time}
          onChange={(next) => update({ ...parts, time: next })}
          ariaLabel={`${shell.label} (giờ)`}
          pickerLabel={`Chọn giờ: ${shell.label}`}
          required={shell.required}
          disabled={shell.disabled}
          invalid={!!shell.error}
          describedBy={describedBy}
        />
      </div>
    </FieldFrame>
  );
}
