"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { ConfirmDialog, Field } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { ApiError } from "@/shared/api/error";
import { dateLabel } from "@/shared/format";
import {
  isValidOrigin,
  originModeLabels,
  classifyGpsError,
  gpsProblemMessages,
  type GpsProblem,
  provinceFromOrigin,
  roadmapEndDate,
  roadmapErrorMessage,
  roadmapFieldErrors,
  roadmapLimits,
  suggestRoadmapTitle,
  validateRoadmapForm,
} from "./roadmap-rules";
import { RoadmapOriginPicker } from "./roadmap-origin-picker";
import { VndField } from "./vnd-field";
import type {
  RoadmapFormValues,
  RoadmapOrigin,
  RoadmapOriginMode,
} from "./roadmap-types";

/**
 * Two ways to give a starting point. With neither chosen the roadmap keeps the
 * default `none` origin (province only), so the contract value stays reachable.
 */
const originChoices: { mode: "pinned" | "gps"; description: string }[] = [
  {
    mode: "pinned",
    description: "Bạn lên kế hoạch từ nơi khác, ví dụ chấm khách sạn sẽ ở.",
  },
  {
    mode: "gps",
    description:
      "Bạn đã tới nơi. Trình duyệt sẽ hỏi bạn có cho ANGI dùng vị trí không.",
  },
];
type GpsStatus = "idle" | "asking" | "granted" | GpsProblem;
/** Names the map dialog gives a point it did not find; they are not useful labels. */
const genericPointNames = new Set([
  "Vị trí đã chọn",
  "Vị trí hiện tại",
  "Hà Nội",
]);

export function RoadmapOverviewForm({
  mode,
  initialValues,
  initialOrigin = null,
  title,
  submitLabel,
  onSubmit,
  onCancel,
  isUnchanged,
}: {
  mode: "create" | "edit";
  initialValues: RoadmapFormValues;
  initialOrigin?: RoadmapOrigin | null;
  title: string;
  submitLabel: string;
  /** Throws `ApiError` on failure; the form keeps every edit and shows the errors. */
  onSubmit: (
    values: RoadmapFormValues,
    origin: RoadmapOrigin | null,
  ) => Promise<void>;
  onCancel?: () => void;
  isUnchanged?: (
    values: RoadmapFormValues,
    origin: RoadmapOrigin | null,
  ) => boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [origin, setOrigin] = useState(initialOrigin);
  // A new plan suggests its title until the traveler types one.
  const [titleEdited, setTitleEdited] = useState(mode === "edit");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const gpsRequest = useRef(0);
  const pointPicked = useRef(false);
  const [provinceNotice, setProvinceNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  const id = useId();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const unchanged = isUnchanged?.(values, origin) ?? false;
  const endDate = roadmapEndDate(values.startDate, values.numDays);
  const days = Number(values.numDays);

  function update(field: keyof RoadmapFormValues, value: string) {
    setValues((previous) => {
      const next = { ...previous, [field]: value };
      if (!titleEdited && (field === "province" || field === "numDays"))
        next.title = suggestRoadmapTitle(next.province, next.numDays);
      return next;
    });
    setErrors((previous) => ({ ...previous, [field]: "" }));
  }
  function setOriginMode(next: RoadmapOriginMode) {
    gpsRequest.current += 1;
    setGpsStatus("idle");
    setValues((previous) => ({ ...previous, originMode: next }));
    setErrors((previous) => ({ ...previous, origin: "", originLabel: "" }));
  }
  function choosePinned() {
    pointPicked.current = false;
    setOriginMode("pinned");
    setMapOpen(true);
  }
  /** Asking for the position here makes the browser show its permission prompt. */
  function chooseGps() {
    setOriginMode("gps");
    const request = gpsRequest.current;
    const fail = (status: GpsStatus) => {
      if (!active.current || request !== gpsRequest.current) return;
      setGpsStatus(status);
      setValues((previous) => ({ ...previous, originMode: "none" }));
    };
    if (!navigator.geolocation) {
      fail(window.isSecureContext ? "unavailable" : "insecure");
      return;
    }
    setGpsStatus("asking");
    navigator.geolocation.getCurrentPosition(
      () => {
        // The position itself is not stored: RM-01 keeps no coordinates for gps.
        if (active.current && request === gpsRequest.current)
          setGpsStatus("granted");
      },
      (positionError) =>
        fail(classifyGpsError(positionError.code, window.isSecureContext)),
      { timeout: 10000, maximumAge: 0 },
    );
  }
  function closeMap() {
    setMapOpen(false);
    // Closing the map without a point leaves the origin unset.
    const kept = pointPicked.current || isValidOrigin(origin);
    if (!kept) setOriginMode("none");
    requestAnimationFrame(() => {
      const target =
        formRef.current?.querySelector<HTMLElement>('[name="origin"]') ??
        formRef.current?.querySelector<HTMLElement>(
          '[data-origin-choice="pinned"]',
        );
      target?.focus();
    });
  }
  function focusError(invalid: Record<string, string>) {
    requestAnimationFrame(() => {
      const field = Object.keys(invalid).find((key) => invalid[key]);
      if (!field) return;
      const control =
        formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`) ??
        formRef.current?.querySelector<HTMLElement>(
          `[data-origin-choice="${values.originMode}"]`,
        );
      control?.focus();
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current || unchanged) return;
    const invalid = validateRoadmapForm(values, origin, {
      requireProvince: mode === "create",
    });
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) {
      focusError(invalid);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await onSubmit(values, values.originMode === "pinned" ? origin : null);
    } catch (caught) {
      if (!active.current) return;
      const fields =
        caught instanceof ApiError ? roadmapFieldErrors(caught.errors) : {};
      setErrors(fields);
      setError(roadmapErrorMessage(caught));
      focusError(fields);
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  function requestCancel() {
    if (busy || !onCancel) return;
    if (unchanged) onCancel();
    else setDiscardOpen(true);
  }

  return (
    <section className="card roadmap-plan-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <form
        ref={formRef}
        className="stack"
        noValidate
        onSubmit={submit}
        aria-busy={busy}
      >
        {error && <Alert>{error}</Alert>}
        <fieldset disabled={busy} className="registration-fields stack">
          {mode === "create" && (
            <ProvinceField
              label="Bạn muốn ăn ở đâu?"
              name="province"
              value={values.province}
              required
              maxLength={100}
              error={errors.province}
              helper="Chọn tỉnh / thành phố. ANGI gợi ý tên lộ trình theo điểm đến."
              onChange={(value) => {
                setProvinceNotice("");
                update("province", value);
              }}
            />
          )}
          {mode === "create" && provinceNotice && (
            <p className="helper" role="status">
              {provinceNotice}
            </p>
          )}
          <fieldset
            className="roadmap-origin"
            aria-describedby={`${id}-origin-help`}
          >
            <legend>Điểm xuất phát</legend>
            <div className="roadmap-origin-options">
              {originChoices.map(({ mode: option, description }) => {
                const selected = values.originMode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    data-origin-choice={option}
                    aria-pressed={selected}
                    aria-describedby={`${id}-origin-help`}
                    className={`roadmap-origin-option ${selected ? "is-selected" : ""}`.trim()}
                    onClick={option === "pinned" ? choosePinned : chooseGps}
                    suppressHydrationWarning
                  >
                    <span className="choice-mark" aria-hidden />
                    <span className="roadmap-origin-text">
                      <strong>{originModeLabels[option]}</strong>
                      <span className="helper">{description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {values.originMode === "pinned" && (
              <div className="roadmap-origin-pinned stack-sm">
                <div className="roadmap-origin-selection">
                  <Button
                    name="origin"
                    variant="secondary"
                    aria-invalid={!!errors.origin}
                    aria-describedby={`${id}-origin-help`}
                    onClick={() => setMapOpen(true)}
                  >
                    {isValidOrigin(origin)
                      ? "Đổi vị trí trên bản đồ"
                      : "Chọn trên bản đồ"}
                  </Button>
                </div>
                <p
                  id={`${id}-origin-help`}
                  className={errors.origin ? "field-error" : "helper"}
                >
                  {errors.origin ||
                    (origin && isValidOrigin(origin)
                      ? `Đã chấm: ${origin.latitude.toFixed(6)}, ${origin.longitude.toFixed(6)}`
                      : "Chấm nơi bạn sẽ ở để ANGI ưu tiên quán gần đó.")}
                </p>
                <Field
                  label="Tên điểm xuất phát"
                  name="originLabel"
                  value={values.originLabel}
                  maxLength={roadmapLimits.originLabel}
                  placeholder="Ví dụ: Khách sạn Sala Đà Nẵng"
                  helper="Không bắt buộc. Giúp bạn nhận ra điểm đã chấm."
                  error={errors.originLabel}
                  onChange={(event) =>
                    update("originLabel", event.target.value)
                  }
                />
              </div>
            )}
            {values.originMode !== "pinned" && (
              <p id={`${id}-origin-help`} className="helper" role="status">
                {gpsStatus === "asking"
                  ? "Đang chờ bạn cho phép truy cập vị trí…"
                  : gpsStatus === "granted" || values.originMode === "gps"
                    ? "Đã cho phép vị trí. Tọa độ không được lưu vào lộ trình; ANGI hỏi lại vị trí mỗi lần gợi ý món hoặc tính đường."
                    : "Không bắt buộc. Nếu chưa biết sẽ ở đâu, bạn chỉ cần chọn tỉnh / thành phố."}
              </p>
            )}
            {gpsStatus !== "idle" &&
              gpsStatus !== "asking" &&
              gpsStatus !== "granted" && (
                <Alert tone="warning">{gpsProblemMessages[gpsStatus]}</Alert>
              )}
            {values.originMode !== "none" && gpsStatus !== "asking" && (
              <Button variant="tertiary" onClick={() => setOriginMode("none")}>
                Bỏ điểm xuất phát
              </Button>
            )}
            {errors.origin && values.originMode !== "pinned" && (
              <p className="field-error">{errors.origin}</p>
            )}
          </fieldset>
          <div className="grid-2">
            <Field
              label="Ngày bắt đầu"
              name="startDate"
              type="date"
              value={values.startDate}
              helper="Không bắt buộc."
              error={errors.startDate}
              onChange={(event) => update("startDate", event.target.value)}
            />
            <Field
              label="Số ngày"
              name="numDays"
              type="number"
              inputMode="numeric"
              min={roadmapLimits.minDays}
              max={roadmapLimits.maxDays}
              step={1}
              value={values.numDays}
              required
              helper={`Từ ${roadmapLimits.minDays} đến ${roadmapLimits.maxDays} ngày.`}
              error={errors.numDays}
              onChange={(event) => update("numDays", event.target.value)}
            />
          </div>
          <VndField
            label="Ngân sách dự kiến"
            name="budgetAmount"
            value={values.budgetAmount}
            placeholder="Ví dụ: 1.500.000 VND"
            helper="Cho mỗi người, cả chuyến. Không bắt buộc."
            error={errors.budgetAmount}
            onValueChange={(digits) => update("budgetAmount", digits)}
          />
          <Field
            label="Tên lộ trình"
            name="title"
            value={values.title}
            required
            maxLength={roadmapLimits.title}
            placeholder="Ví dụ: 3 ngày ăn ngon Đà Nẵng"
            helper={
              titleEdited
                ? undefined
                : "Gợi ý theo điểm đến và số ngày. Bạn có thể đổi."
            }
            error={errors.title}
            onChange={(event) => {
              setTitleEdited(true);
              update("title", event.target.value);
            }}
          />
          <p className="roadmap-plan-summary" aria-live="polite">
            <span>
              {Number.isInteger(days) &&
              days >= roadmapLimits.minDays &&
              days <= roadmapLimits.maxDays
                ? `${days} ngày`
                : "Chưa có số ngày"}
            </span>
            <span>
              {endDate
                ? `${dateLabel(values.startDate)} – ${dateLabel(endDate)}`
                : "Chưa chọn ngày đi"}
            </span>
            <span>{originModeLabels[values.originMode]}</span>
          </p>
        </fieldset>
        <div className="actions registration-actions">
          <Button
            type="submit"
            loading={busy}
            disabled={unchanged}
            className={onCancel ? undefined : "full-width"}
          >
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="secondary" disabled={busy} onClick={requestCancel}>
              Hủy
            </Button>
          )}
        </div>
        {unchanged && mode === "edit" && (
          <p className="helper">Chưa có thay đổi để lưu.</p>
        )}
      </form>
      {mapOpen && (
        <RoadmapOriginPicker
          location={origin}
          onClose={closeMap}
          onSelect={(point) => {
            pointPicked.current = true;
            setOrigin(point);
            if (mode === "create") {
              // The picked address decides the destination province.
              const found = provinceFromOrigin(point);
              if (found.province) update("province", found.province);
              setProvinceNotice(found.notice);
            }
            setErrors((previous) => ({ ...previous, origin: "" }));
            if (
              !values.originLabel.trim() &&
              !genericPointNames.has(point.name)
            )
              update("originLabel", point.name);
          }}
        />
      )}
      <ConfirmDialog
        open={discardOpen}
        title="Bỏ thay đổi chưa lưu?"
        destructive
        label="Bỏ thay đổi"
        cancelLabel="Tiếp tục chỉnh sửa"
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onCancel?.();
        }}
      >
        <p>Những gì bạn vừa sửa trong lộ trình sẽ không được lưu.</p>
      </ConfirmDialog>
    </section>
  );
}
