"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Alert, Button } from "@/shared/ui";
import { Calendar } from "@/components/ui/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";
import { dateToIso, isoToDate } from "@/components/ui/date-time-rules";
import { dateLabel } from "@/shared/format";
import {
  buildDateRangePatch,
  buildTitlePatch,
  dateRangeError,
  lastPickableDay,
  maxPickableDays,
  nextDateRange,
  roadmapErrorMessage,
  roadmapLimits,
  roadmapTitleError,
  tripDays,
  type PickedDateRange,
} from "./roadmap-rules";
import { roadmapDateRange } from "./roadmap-list-rules";
import type { RoadmapScreenService } from "./roadmap-service";
import type {
  RoadmapDetailDto,
  RoadmapSummaryDto,
  UpdateRoadmapRequestDto,
} from "./roadmap-types";

interface OverviewEditorProps {
  overview: RoadmapSummaryDto;
  service: Pick<RoadmapScreenService, "update">;
  /** Receives the RoadmapDetail returned by RM-04. */
  onSaved: (detail: RoadmapDetailDto) => void;
}

/** One RM-04 call at a time; an empty patch is a success that calls nothing. */
function useOverviewSave(
  roadmapId: number,
  service: OverviewEditorProps["service"],
  onSaved: OverviewEditorProps["onSaved"],
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  async function save(patch: UpdateRoadmapRequestDto) {
    if (running.current) return false;
    if (Object.keys(patch).length === 0) return true;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      onSaved(await service.update(roadmapId, patch));
      return true;
    } catch (caught) {
      setError(roadmapErrorMessage(caught));
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, setError, save, running };
}

/**
 * The hero title, edited in place: a click turns it into a field; Enter or a click outside saves
 * (RM-04 `title`), Escape gives up. An invalid or refused title keeps the field open with the reason.
 */
export function RoadmapTitleEditor({
  overview,
  service,
  onSaved,
}: OverviewEditorProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(overview.title);
  const { busy, error, setError, save, running } = useOverviewSave(
    overview.id,
    service,
    onSaved,
  );
  // Read by the blur that follows Enter or Escape, before React has re-rendered.
  const active = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  function start() {
    active.current = true;
    setText(overview.title);
    setError(null);
    setEditing(true);
  }
  function finish() {
    active.current = false;
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  }
  async function commit() {
    if (!active.current || running.current) return;
    const problem = roadmapTitleError(text);
    if (problem) {
      setError(problem);
      return;
    }
    if (await save(buildTitlePatch(text, overview.title))) finish();
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape" && !running.current) {
      event.preventDefault();
      finish();
    }
  }

  if (!editing)
    return (
      <>
        <h1 id="roadmap-title">
          <button
            ref={opener}
            type="button"
            className="roadmap-title-button"
            onClick={start}
            aria-describedby={`${id}-hint`}
          >
            {overview.title}
            <PencilIcon aria-hidden className="roadmap-hero-edit-icon" />
          </button>
        </h1>
        <span id={`${id}-hint`} className="sr-only">
          Bấm để sửa tên lộ trình.
        </span>
      </>
    );
  return (
    <div className="roadmap-title-editor">
      <h1 id="roadmap-title" className="sr-only">
        {overview.title}
      </h1>
      <input
        ref={input}
        className="roadmap-title-input"
        aria-label="Tên lộ trình"
        placeholder="Ví dụ: Khám phá ẩm thực Hà Nội"
        value={text}
        maxLength={roadmapLimits.title}
        readOnly={busy}
        aria-busy={busy || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-status`}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={keyDown}
        onBlur={() => void commit()}
      />
      <p
        id={`${id}-status`}
        className={error ? "field-error" : "helper"}
        role={error ? "alert" : undefined}
      >
        {busy
          ? "Đang lưu…"
          : (error ?? "Enter hoặc bấm ra ngoài để lưu, Esc để hủy.")}
      </p>
    </div>
  );
}

/**
 * The hero dates as a button that opens a range picker (shadcn Calendar). Saving sends the start
 * date and the number of days (RM-04 `startDate`, `numDays`); the end date is derived from them.
 */
export function RoadmapDatesPicker({
  overview,
  service,
  onSaved,
}: OverviewEditorProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<PickedDateRange>({});
  const { busy, error, setError, save } = useOverviewSave(
    overview.id,
    service,
    onSaved,
  );
  const label = roadmapDateRange(overview);
  const maxDays = maxPickableDays(overview.numDays);

  function openChange(next: boolean) {
    if (busy) return;
    if (next) {
      setRange(
        overview.startDate
          ? {
              from: overview.startDate,
              to: overview.endDate ?? overview.startDate,
            }
          : {},
      );
      setError(null);
    }
    setOpen(next);
  }
  async function submit() {
    if (!range.from || !range.to) {
      setError("Chọn ngày đi rồi chọn ngày về.");
      return;
    }
    const problem = dateRangeError(range.from, range.to, maxDays);
    if (problem) {
      setError(problem);
      return;
    }
    if (await save(buildDateRangePatch(range.from, range.to, overview)))
      setOpen(false);
  }

  const from = range.from ? (isoToDate(range.from) ?? undefined) : undefined;
  const to = range.to ? (isoToDate(range.to) ?? undefined) : undefined;
  const lastDay =
    range.from && !range.to
      ? isoToDate(lastPickableDay(range.from, maxDays))
      : null;
  const picked =
    range.from && range.to
      ? `${dateLabel(range.from)} – ${dateLabel(range.to)} · ${tripDays(range.from, range.to)} ngày`
      : range.from
        ? `Ngày đi ${dateLabel(range.from)}. Chọn ngày về (tối đa ${maxDays} ngày).`
        : "Chọn ngày đi.";

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="roadmap-hero-dates"
          aria-label={`Đổi ngày đi và ngày về: ${label}`}
        >
          <CalendarIcon aria-hidden />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="roadmap-dates-picker"
        aria-label="Chọn ngày đi và ngày về"
      >
        <Calendar
          mode="range"
          selected={from ? { from, to } : undefined}
          onSelect={(_, day) => {
            setError(null);
            setRange((current) => nextDateRange(current, dateToIso(day)));
          }}
          defaultMonth={from ?? new Date()}
          disabled={lastDay ? { after: lastDay } : undefined}
          classNames={{
            range_start: "is-range-start",
            range_middle: "is-range-middle",
            range_end: "is-range-end",
          }}
        />
        <p className="helper roadmap-dates-picked" aria-live="polite">
          {picked}
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="roadmap-dates-actions">
          <Button
            variant="secondary"
            onClick={() => openChange(false)}
            disabled={busy}
          >
            Hủy
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Lưu ngày
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
