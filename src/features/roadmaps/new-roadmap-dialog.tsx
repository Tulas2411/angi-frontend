"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPinIcon } from "@heroicons/react/20/solid";
import { Alert, Button } from "@/shared/ui";
import { Dialog, Field } from "@/components/ui/primitives";
import { DateField } from "@/components/ui/date-time-fields";
import { dateToIso } from "@/components/ui/date-time-rules";
import { ProvinceField } from "@/components/domain/province-field";
import { ApiError } from "@/shared/api/error";
import { dateLabel } from "@/shared/format";
import { notify } from "@/shared/ui/notify";
import { resolveRestaurantAddress } from "@/features/owner/location-service";
import { rememberDestination } from "./roadmap-destination";
import { RoadmapOriginPicker } from "./roadmap-origin-picker";
import {
  buildCreateRoadmapRequest,
  classifyGpsError,
  emptyRoadmapForm,
  gpsProblemMessages,
  isValidOrigin,
  originModeLabels,
  provinceFromOrigin,
  roadmapEndDate,
  roadmapErrorMessage,
  roadmapFieldErrors,
  roadmapLimits,
  roadmapPlaceSummary,
  suggestRoadmapTitle,
  validateRoadmapForm,
  validateRoadmapPlace,
  type GpsProblem,
  type RoadmapPlaceKnowledge,
} from "./roadmap-rules";
import { roadmapService, type RoadmapPlanService } from "./roadmap-service";
import { roadmapDetailHref } from "./routes";
import type {
  RoadmapFormValues,
  RoadmapOrigin,
  RoadmapOriginMode,
} from "./roadmap-types";
import { VndField } from "./vnd-field";
import "./new-roadmap-dialog.css";

const knowledgeChoices: {
  value: RoadmapPlaceKnowledge;
  label: string;
  description: string;
}[] = [
  {
    value: "known",
    label: "Đã biết chính xác",
    description: "Chọn nơi bạn sẽ ở trên bản đồ, hoặc lấy vị trí hiện tại",
  },
  {
    value: "unknown",
    label: "Chưa biết chính xác",
    description: "Chỉ cần chọn tỉnh / thành phố bạn sẽ đến.",
  },
];
const originChoices: {
  mode: "pinned" | "gps";
  description: string;
}[] = [
  {
    mode: "pinned",
    description: "Ví dụ chấm khách sạn bạn sẽ ở.",
  },
  {
    mode: "gps",
    description: "Trình duyệt sẽ hỏi bạn có cho ANGI dùng vị trí không.",
  },
];
type GpsStatus = "idle" | "asking" | "granted" | GpsProblem;
/** Names the map dialog gives a point it did not find; they are not useful labels. */
const genericPointNames = new Set([
  "Vị trí đã chọn",
  "Vị trí hiện tại",
  "Hà Nội",
]);

/**
 * F-19 "Lập lộ trình mới" in two steps. Step 1 asks where the traveler will be: an exact place (a
 * point on the map, or the current location) or only the city. Step 2 asks the rest (dates,
 * days, budget, title). RM-01 creates the roadmap, then its detail page opens.
 */
export function NewRoadmapDialog({
  onClose,
  service = roadmapService,
}: {
  onClose: () => void;
  service?: RoadmapPlanService;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [knowledge, setKnowledge] = useState<RoadmapPlaceKnowledge | null>(
    null,
  );
  const [values, setValues] = useState<RoadmapFormValues>(emptyRoadmapForm);
  const [origin, setOrigin] = useState<RoadmapOrigin | null>(null);
  const [titleEdited, setTitleEdited] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [provinceNotice, setProvinceNotice] = useState("");
  // A map point names its own city; the city field shows only when that lookup found none.
  const [pointCity, setPointCity] = useState<"found" | "missing" | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const gpsRequest = useRef(0);
  const pointPicked = useRef(false);
  const submitting = useRef(false);
  const active = useRef(true);
  const body = useRef<HTMLDivElement>(null);
  const formId = useId();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      gpsRequest.current += 1;
    };
  }, []);
  // Each step starts on its first control, for keyboard and screen-reader users.
  useEffect(() => {
    requestAnimationFrame(() =>
      body.current?.querySelector<HTMLElement>("[data-step-start]")?.focus(),
    );
  }, [step]);

  function update(field: keyof RoadmapFormValues, value: string) {
    setValues((previous) => {
      const next = { ...previous, [field]: value };
      if (!titleEdited && field === "province")
        next.title = suggestRoadmapTitle(next.province);
      return next;
    });
    setErrors((previous) => ({ ...previous, [field]: "" }));
  }
  function setOriginMode(next: RoadmapOriginMode) {
    gpsRequest.current += 1;
    setGpsStatus("idle");
    setValues((previous) => ({ ...previous, originMode: next }));
    setErrors((previous) => ({ ...previous, origin: "" }));
  }
  function chooseKnowledge(next: RoadmapPlaceKnowledge) {
    setKnowledge(next);
    setErrors({});
    // "Not sure yet" keeps only the city: no point and no location is sent.
    if (next === "unknown") {
      setOriginMode("none");
      setOrigin(null);
      setProvinceNotice("");
    }
  }
  function choosePinned() {
    pointPicked.current = false;
    setOriginMode("pinned");
    setMapOpen(true);
  }
  /** Asking for the position makes the browser show its permission prompt. */
  function chooseGps() {
    setOriginMode("gps");
    const request = gpsRequest.current;
    const current = () => active.current && request === gpsRequest.current;
    const fail = (status: GpsStatus) => {
      if (!current()) return;
      setGpsStatus(status);
      setValues((previous) => ({ ...previous, originMode: "none" }));
    };
    if (!navigator.geolocation) {
      fail(window.isSecureContext ? "unavailable" : "insecure");
      return;
    }
    setGpsStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!current()) return;
        setGpsStatus("granted");
        // The coordinates only name the city here: RM-01 stores none for gps.
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token) return;
        const controller = new AbortController();
        resolveRestaurantAddress(
          {
            name: originModeLabels.gps,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          token,
          controller.signal,
        )
          .then((point) => {
            if (!current()) return;
            const found = provinceFromOrigin(point);
            if (found.province) {
              update("province", found.province);
              setProvinceNotice(
                `Đã điền tỉnh / thành phố theo vị trí hiện tại: ${found.province}.`,
              );
            }
          })
          .catch(() => {
            // No lookup: the traveler picks the city below.
          });
      },
      (positionError) =>
        fail(classifyGpsError(positionError.code, window.isSecureContext)),
      { timeout: 10000, maximumAge: 0 },
    );
  }
  function closeMap() {
    setMapOpen(false);
    // Closing the map without a point leaves the place unset.
    if (!pointPicked.current && !isValidOrigin(origin)) setOriginMode("none");
  }
  function focusFirstError(invalid: Record<string, string>) {
    requestAnimationFrame(() => {
      const field = Object.keys(invalid).find((key) => invalid[key]);
      if (!field) return;
      body.current
        ?.querySelector<HTMLElement>(
          `[name="${field}"], [data-error-anchor="${field}"]`,
        )
        ?.focus();
    });
  }
  function next() {
    const invalid = validateRoadmapPlace(knowledge, values, origin, {
      gpsReady: gpsStatus === "granted",
    });
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      focusFirstError(invalid);
      return;
    }
    setStep(2);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current) return;
    const invalid = validateRoadmapForm(values, origin);
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) {
      // A place problem belongs to step 1; the rest is on this step.
      if (invalid.province || invalid.origin) setStep(1);
      else focusFirstError(invalid);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const created = await service.create(
        buildCreateRoadmapRequest(
          values,
          values.originMode === "pinned" ? origin : null,
        ),
      );
      // RM-01 keeps no destination; RM-06 asks for it, so remember it for this browser.
      rememberDestination(created.overview.id, values.province);
      notify.success("Đã tạo lộ trình. Thêm món cho từng bữa nhé.");
      // Stays busy until the detail page replaces the list, so it cannot be sent twice.
      router.push(roadmapDetailHref(created.overview.id));
    } catch (caught) {
      submitting.current = false;
      if (!active.current) return;
      setBusy(false);
      const fields =
        caught instanceof ApiError ? roadmapFieldErrors(caught.errors) : {};
      setErrors(fields);
      setError(roadmapErrorMessage(caught));
      focusFirstError(fields);
    }
  }
  function requestClose() {
    if (!busy) onClose();
  }

  const days = Number(values.numDays);
  const endDate = roadmapEndDate(values.startDate, values.numDays);
  const gpsNote =
    gpsStatus === "asking"
      ? "Đang chờ bạn cho phép truy cập vị trí…"
      : gpsStatus === "granted"
        ? "Đã cho phép vị trí. Tọa độ không được lưu vào lộ trình; ANGI hỏi lại mỗi lần gợi ý món hoặc tính đường."
        : "";

  return (
    <Dialog
      open
      onClose={requestClose}
      title="Lập lộ trình mới"
      className="new-roadmap-dialog"
      // Each step keys its own buttons. Reusing one <button> would turn "Tiếp tục" into the
      // submit button while its click is still running, and the browser would send the form.
      footer={
        step === 1 ? (
          <>
            <Button key="cancel" variant="secondary" onClick={requestClose}>
              Hủy
            </Button>
            <Button key="next" onClick={next}>
              Tiếp tục
            </Button>
          </>
        ) : (
          <>
            <Button
              key="back"
              variant="secondary"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              Quay lại
            </Button>
            {/* Outside the form, in the dialog footer: it submits the form by id. */}
            <Button key="create" type="submit" form={formId} loading={busy}>
              Tạo lộ trình
            </Button>
          </>
        )
      }
    >
      <div ref={body} className="new-roadmap stack">
        <p className="new-roadmap-step" aria-live="polite">
          Bước {step} / 2 ·{" "}
          {step === 1 ? "Bạn sẽ ăn ở đâu" : "Thời gian và ngân sách"}
        </p>
        {step === 1 ? (
          <div className="stack">
            <fieldset className="new-roadmap-group">
              <legend>Bạn đã biết chính xác nơi mình sẽ đến chưa?</legend>
              <div className="new-roadmap-options">
                {knowledgeChoices.map((choice, index) => {
                  const selected = knowledge === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      data-knowledge={choice.value}
                      data-step-start={index === 0 ? "" : undefined}
                      data-error-anchor={index === 0 ? "knowledge" : undefined}
                      aria-pressed={selected}
                      className={`new-roadmap-option ${selected ? "is-selected" : ""}`.trim()}
                      onClick={() => chooseKnowledge(choice.value)}
                    >
                      <span className="choice-mark" aria-hidden />
                      <span className="new-roadmap-option-text">
                        <strong>{choice.label}</strong>
                        <span className="helper">{choice.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.knowledge && (
                <p className="field-error">{errors.knowledge}</p>
              )}
            </fieldset>

            {knowledge === "known" && (
              <fieldset className="new-roadmap-group">
                <legend>Vị trí của bạn</legend>
                <div className="new-roadmap-options is-row">
                  {originChoices.map(({ mode, description }, index) => {
                    const selected = values.originMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        data-origin-choice={mode}
                        data-error-anchor={index === 0 ? "origin" : undefined}
                        aria-pressed={selected}
                        className={`new-roadmap-option ${selected ? "is-selected" : ""}`.trim()}
                        onClick={mode === "pinned" ? choosePinned : chooseGps}
                      >
                        <span className="choice-mark" aria-hidden />
                        <span className="new-roadmap-option-text">
                          <strong>{originModeLabels[mode]}</strong>
                          <span className="helper">{description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {values.originMode === "pinned" && isValidOrigin(origin) && (
                  <div className="new-roadmap-point">
                    <MapPinIcon aria-hidden />
                    <span>
                      {pointCity === "found"
                        ? roadmapPlaceSummary(values)
                        : `${values.originLabel.trim() || "Điểm đã chấm"} · ${origin!.latitude.toFixed(6)}, ${origin!.longitude.toFixed(6)}`}
                    </span>
                    <Button variant="tertiary" onClick={() => setMapOpen(true)}>
                      Đổi vị trí
                    </Button>
                  </div>
                )}
                {gpsNote && (
                  <p className="helper" role="status">
                    {gpsNote}
                  </p>
                )}
                {gpsStatus !== "idle" &&
                  gpsStatus !== "asking" &&
                  gpsStatus !== "granted" && (
                    <Alert tone="warning">
                      {gpsProblemMessages[gpsStatus]}
                    </Alert>
                  )}
                {errors.origin && (
                  <p className="field-error">{errors.origin}</p>
                )}
              </fieldset>
            )}

            {(knowledge === "unknown" ||
              (knowledge === "known" && values.originMode === "gps") ||
              (knowledge === "known" &&
                values.originMode === "pinned" &&
                pointCity === "missing")) && (
              <ProvinceField
                label={
                  knowledge === "known"
                    ? "Tỉnh / thành phố"
                    : "Bạn sẽ đến tỉnh / thành phố nào?"
                }
                name="province"
                value={values.province}
                required
                // The trip's destination is saved (RM-01): only a province of the catalog.
                strict
                maxLength={100}
                error={errors.province}
                helper={
                  knowledge === "unknown"
                    ? "ANGI gợi ý món và quán trong tỉnh / thành phố này."
                    : values.originMode === "pinned"
                      ? "Chưa tự lấy được tỉnh / thành phố từ điểm đã chấm. Bạn hãy chọn."
                      : "Tự điền theo vị trí hiện tại. Bạn có thể đổi."
                }
                onChange={(value) => {
                  setProvinceNotice("");
                  update("province", value);
                }}
              />
            )}
            {provinceNotice && (
              <p className="helper" role="status">
                {provinceNotice}
              </p>
            )}
          </div>
        ) : (
          <form
            id={formId}
            className="stack"
            noValidate
            onSubmit={submit}
            aria-busy={busy}
          >
            {error && <Alert>{error}</Alert>}
            <div className="new-roadmap-place">
              <MapPinIcon aria-hidden />
              <span>
                <span className="sr-only">Nơi đến: </span>
                {roadmapPlaceSummary(values)}
              </span>
              <Button
                variant="tertiary"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                Đổi
              </Button>
            </div>
            <fieldset disabled={busy} className="stack">
              {values.originMode === "pinned" && (
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
              )}
              <div className="grid-2">
                <DateField
                  label="Ngày bắt đầu"
                  name="startDate"
                  value={values.startDate}
                  // A new trip cannot start in the past: earlier days are greyed out and not pickable.
                  min={dateToIso(new Date())}
                  helper="Không bắt buộc."
                  error={errors.startDate}
                  onChange={(value) => update("startDate", value)}
                />
                <Field
                  data-step-start=""
                  placeholder="Ví dụ: 3"
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
                placeholder="Ví dụ: Khám phá ẩm thực Đà Nẵng"
                helper={
                  titleEdited
                    ? undefined
                    : "Gợi ý theo điểm đến. Bạn có thể đổi."
                }
                error={errors.title}
                onChange={(event) => {
                  setTitleEdited(true);
                  update("title", event.target.value);
                }}
              />
              <p className="new-roadmap-summary" aria-live="polite">
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
              </p>
            </fieldset>
          </form>
        )}
      </div>
      {mapOpen && (
        <RoadmapOriginPicker
          location={origin}
          onClose={closeMap}
          onSelect={(point) => {
            pointPicked.current = true;
            setOrigin(point);
            // The picked address decides the city.
            const found = provinceFromOrigin(point);
            if (found.province) update("province", found.province);
            setPointCity(found.province ? "found" : "missing");
            // The city is shown with the point; the field below explains a failed lookup itself.
            setProvinceNotice("");
            setErrors((previous) => ({ ...previous, origin: "" }));
            if (
              !values.originLabel.trim() &&
              !genericPointNames.has(point.name)
            )
              update("originLabel", point.name);
          }}
        />
      )}
    </Dialog>
  );
}
