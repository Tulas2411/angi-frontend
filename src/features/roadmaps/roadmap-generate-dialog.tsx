"use client";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Alert, Button } from "@/shared/ui";
import {
  Choice,
  Dialog,
  Field,
  SelectField,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { loadProvinceCatalog } from "@/shared/locations/province-service";
import { provinceFromText } from "./roadmap-add-item-rules";
import { dayTitle, mealSlotLabels } from "./roadmap-detail-rules";
import {
  buildGenerateRequest,
  defaultRadiusKm,
  generateError,
  generationStatusText,
  generationSummary,
  generationTips,
  hasGenerationOrigin,
  noteMaxLength,
  preferenceTags,
  generationPlan,
  generationPlanText,
  generationSubmitLabel,
  tagChoice,
  toggleMealSlot,
  validateGenerateForm,
  withTagChoice,
  type GenerateForm,
} from "./roadmap-generate-rules";
import { recallGenerationJob } from "./roadmap-generation-job";
import type { GenerationWatch } from "./roadmap-generation-watch";
import { AngiWorker } from "./angi-worker";
import { rememberDestination } from "./roadmap-destination";
import type { RoadmapGenerationService } from "./roadmap-service";
import type {
  GenerationScope,
  RoadmapDayDto,
  RoadmapSummaryDto,
  RoadmapTagDto,
} from "./roadmap-types";
import { VndField } from "./vnd-field";
import { MealChips } from "./roadmap-meal-chips";
import { MapPinIcon } from "@heroicons/react/24/outline";
import "./roadmap-pickers.css";
import "./roadmap-generate.css";

const scopeTabs: { value: GenerationScope; label: string }[] = [
  { value: "full", label: "Cả lộ trình" },
  { value: "day", label: "Một ngày" },
  { value: "slot", label: "Một bữa" },
];

function originNote(
  overview: RoadmapSummaryDto,
  gps: { latitude: number; longitude: number } | undefined,
): string {
  if (overview.originMode === "pinned")
    return `ANGI ưu tiên quán quanh ${overview.originLabel?.trim() || "điểm xuất phát đã chấm"} và gom các quán gần nhau trong từng ngày.`;
  if (overview.originMode === "gps")
    return gps
      ? "ANGI ưu tiên quán quanh vị trí hiện tại của bạn và gom các quán gần nhau trong từng ngày."
      : "Muốn ANGI ưu tiên quán gần bạn, hãy cho phép vị trí ở phần Lịch trình rồi mở lại hộp này.";
  return "Lộ trình chưa có điểm xuất phát, nên ANGI chỉ gom các quán gần nhau trong từng ngày.";
}

function TagChips({
  label,
  tags,
  pressed,
  onToggle,
}: {
  label: string;
  tags: readonly RoadmapTagDto[];
  pressed: (tag: RoadmapTagDto) => boolean;
  onToggle: (tag: RoadmapTagDto) => void;
}) {
  return (
    <div className="roadmap-generate-tags" role="group" aria-label={label}>
      <p className="roadmap-generate-legend">{label}</p>
      <div className="roadmap-generate-chips">
        {tags.map((tag) => (
          <button
            type="button"
            key={tag.id}
            className={`chip ${pressed(tag) ? "selected" : ""}`}
            aria-pressed={pressed(tag)}
            onClick={() => onToggle(tag)}
            suppressHydrationWarning
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** F-26: ask ANGI to fill the roadmap, a day or a meal (RM-10) and follow the job (RM-11). */
export function RoadmapGenerateDialog({
  roadmapId,
  overview,
  itinerary,
  initialScope,
  initialDayId,
  defaultProvince,
  gpsOrigin,
  service,
  watch,
  onHide,
  onClose,
}: {
  roadmapId: number;
  overview: RoadmapSummaryDto;
  itinerary: RoadmapDayDto[];
  initialScope: GenerationScope;
  initialDayId: number;
  defaultProvince: string;
  gpsOrigin?: { latitude: number; longitude: number };
  service: RoadmapGenerationService;
  /** The job follow-up, owned by the roadmap screen so it outlives this dialog. */
  watch: GenerationWatch;
  /** "Ẩn, ANGI vẫn tạo ở nền": the dialog goes, the job and its worker badge stay. */
  onHide: () => void;
  onClose: () => void;
}) {
  const formId = useId();
  const [form, setForm] = useState<GenerateForm>({
    scope: initialScope,
    dayId: String(initialDayId),
    mealSlot: "lunch",
    mealSlots: ["breakfast", "lunch", "dinner"],
    province: defaultProvince,
    maxPrice: "",
    note: "",
    replaceExisting: false,
    preferTagIds: [],
    excludeTagIds: [],
    radiusKm: String(defaultRadiusKm),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{
    message: string;
    inProgress: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The job lives in the screen's watch: a job started before the dialog was hidden is shown
  // again here instead of being queued twice.
  const phase = watch.state;
  const [tags, setTags] = useState<RoadmapTagDto[]>([]);
  const mounted = useRef(true);
  const touchedProvince = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The tag catalog is optional: without it the preference groups simply do not show.
  useEffect(() => {
    service
      .tags()
      .then((all) => {
        if (mounted.current) setTags(preferenceTags(all));
      })
      .catch(() => undefined);
  }, [service]);

  // No remembered or inferred province: read it from the roadmap's title ("Đi chơi Hà Nội").
  useEffect(() => {
    if (defaultProvince.trim()) return;
    void loadProvinceCatalog()
      .then((catalog) => {
        const name = provinceFromText(overview.title, catalog);
        if (!name || !mounted.current || touchedProvince.current) return;
        setForm((previous) => ({ ...previous, province: name }));
      })
      .catch(() => undefined);
    // Runs once; the title is only a hint and the traveler can still type another province.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While ANGI works, a line of what it is doing changes every few seconds.
  const [tip, setTip] = useState(0);
  const running = phase.kind === "running" && !phase.stalled;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => setTip((value) => (value + 1) % generationTips.length),
      2800,
    );
    return () => clearInterval(timer);
  }, [running]);

  const hasOrigin = hasGenerationOrigin(overview.originMode, gpsOrigin);
  const day = itinerary.find((entry) => String(entry.dayId) === form.dayId);
  const plan = generationPlan(form, itinerary);
  const where =
    form.scope === "full"
      ? "trong lộ trình"
      : form.scope === "day"
        ? `của ${day ? dayTitle(day) : "ngày này"}`
        : `ở ${mealSlotLabels[form.mealSlot].toLowerCase()} của ${day ? dayTitle(day) : "ngày này"}`;
  const noMealChosen = form.scope !== "slot" && form.mealSlots.length === 0;
  // Every chosen meal already has its dish and nothing is replaced: there is nothing to ask for.
  const nothingToFill = !noMealChosen && plan.meals === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const invalid = validateGenerateForm(form, { hasOrigin });
    setErrors(invalid);
    setFormError(null);
    if (Object.keys(invalid).length) return;
    setSubmitting(true);
    try {
      const queued = await service.generate(
        roadmapId,
        buildGenerateRequest(form, {
          originMode: overview.originMode,
          gps: gpsOrigin,
        }),
      );
      if (!mounted.current) return;
      rememberDestination(roadmapId, form.province);
      watch.start(queued.jobId, form);
    } catch (caught) {
      if (mounted.current) setFormError(generateError(caught));
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  const replaceNow = plan.replaced > 0;
  const footer =
    // Each phase's buttons have their own key: React must not reuse the button that was just
    // clicked ("Chỉnh điều kiện") as the next phase's submit button, or that same click submits.
    phase.kind === "idle" || phase.kind === "leaving" ? (
      <Fragment key="form">
        {/*
         * Always in sight, next to the buttons: what the request will do, and the one choice
         * that deletes dishes. The button names the same count.
         */}
        <div className="roadmap-generate-plan">
          <Choice
            label="Thay các món đã có trong phạm vi"
            checked={form.replaceExisting}
            onChange={(checked) =>
              setForm((previous) => ({ ...previous, replaceExisting: checked }))
            }
          />
          <p
            className="roadmap-generate-plan-text"
            data-tone={replaceNow ? "warning" : undefined}
            aria-live="polite"
          >
            {noMealChosen
              ? "Chọn ít nhất một bữa để ANGI tạo."
              : generationPlanText(plan, where)}
          </p>
        </div>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button
          type="submit"
          form={formId}
          variant={replaceNow ? "destructive" : "primary"}
          loading={submitting}
          disabled={nothingToFill}
        >
          {plan.meals > 0 ? generationSubmitLabel(plan) : "Tạo lịch bằng AI"}
        </Button>
      </Fragment>
    ) : phase.kind === "running" ? (
      <Fragment key="running">
        {phase.stalled && (
          <Button variant="secondary" onClick={watch.retry}>
            Kiểm tra lại
          </Button>
        )}
        <Button variant="secondary" onClick={onHide}>
          Ẩn, ANGI vẫn tạo ở nền
        </Button>
      </Fragment>
    ) : (
      <Fragment key="failed">
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        <Button onClick={watch.reset}>Chỉnh điều kiện</Button>
      </Fragment>
    );

  let content: ReactNode;
  if (phase.kind === "running") {
    const { submitted, stalled, job } = phase;
    const summary = submitted
      ? generationSummary(
          submitted,
          dayTitle(
            itinerary.find(
              (entry) => String(entry.dayId) === submitted.dayId,
            ) ?? itinerary[0],
          ),
          mealSlotLabels,
        )
      : null;
    const status = job?.status ?? "queued";
    // Queued, then choosing dishes, then writing them in: one chip per step on a line.
    const steps = [
      { label: "Xếp hàng", state: status === "running" ? "done" : "active" },
      {
        label: "Chọn món, gom quán gần nhau",
        state: status === "running" ? "active" : "todo",
      },
      { label: "Ghi vào lộ trình", state: "todo" },
    ];
    content = (
      <div
        className={`roadmap-generate-run ${stalled ? "is-stalled" : ""}`.trim()}
        aria-live="polite"
      >
        <AngiWorker className="is-large" />
        <p role="status" className="roadmap-generate-run-status">
          <strong>{stalled ?? generationStatusText(status)}</strong>
        </p>
        {!stalled && (
          <p className="roadmap-generate-run-tip" aria-hidden>
            <span key={tip}>{generationTips[tip]}</span>
          </p>
        )}
        <ol className="roadmap-generate-run-steps" aria-label="Tiến trình">
          {steps.map((step) => (
            <li key={step.label} data-state={step.state}>
              <span className="roadmap-generate-run-dot" aria-hidden />
              {step.label}
            </li>
          ))}
        </ol>
        {summary && <p className="helper">{summary}</p>}
        <p className="helper">
          Thường chỉ mất vài giây. Bạn có thể ẩn hộp này, ANGI vẫn tạo ở nền và
          báo khi xong.
        </p>
      </div>
    );
  } else if (phase.kind === "failed")
    content = (
      <div className="stack">
        <Alert>{phase.message}</Alert>
        <p className="helper">
          Điều kiện của bạn vẫn được giữ, bạn có thể chỉnh rồi thử lại.
        </p>
      </div>
    );
  else {
    const preferred = (tag: RoadmapTagDto) =>
      tagChoice(form, tag.id) === "prefer";
    const avoided = (tag: RoadmapTagDto) =>
      tagChoice(form, tag.id) === "exclude";
    content = (
      <form
        id={formId}
        className="roadmap-generate stack"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <p className="helper">
          ANGI chọn mỗi bữa một món hợp với bạn và gom các quán gần nhau trong
          ngày; bạn sửa từng món sau nếu muốn.
        </p>
        {/* Scope and day on one row: what part of the roadmap ANGI fills. */}
        <div className="roadmap-generate-scope">
          <Tabs
            label="Phạm vi tạo"
            value={form.scope}
            items={scopeTabs}
            onChange={(value) =>
              setForm((previous) => ({
                ...previous,
                scope: value as GenerationScope,
              }))
            }
          />
          {form.scope !== "full" && (
            <div className="roadmap-generate-day">
              <SelectField
                label="Ngày"
                name="dayId"
                value={form.dayId}
                error={errors.dayId}
                onChange={(value) =>
                  setForm((previous) => ({ ...previous, dayId: value }))
                }
                options={itinerary.map((entry) => ({
                  value: String(entry.dayId),
                  label: dayTitle(entry),
                }))}
              />
            </div>
          )}
        </div>
        {/* Several meals as checkbox chips, or one meal as radio chips ("Một bữa"). */}
        <fieldset className="roadmap-generate-meals">
          <legend>
            {form.scope === "slot"
              ? "Bữa ANGI cần tạo"
              : "Các bữa ANGI cần tạo"}
          </legend>
          {form.scope === "slot" ? (
            <MealChips
              name="mealSlot"
              selected={[form.mealSlot]}
              onToggle={(slot) =>
                setForm((previous) => ({ ...previous, mealSlot: slot }))
              }
            />
          ) : (
            <MealChips
              name="mealSlots"
              multiple
              selected={form.mealSlots}
              onToggle={(slot, checked) => {
                setForm((previous) => ({
                  ...previous,
                  mealSlots: toggleMealSlot(previous.mealSlots, slot, checked),
                }));
                setErrors((previous) => ({ ...previous, mealSlots: "" }));
              }}
            />
          )}
          {errors.mealSlots && (
            <p className="field-error" role="alert">
              {errors.mealSlots}
            </p>
          )}
        </fieldset>
        {/* Where ANGI looks and how much a dish may cost: the bar of "Thêm món". */}
        <div className="stack-sm">
          <div className="roadmap-searchbar">
            <div className="roadmap-searchbar-part">
              <ProvinceField
                label="Tỉnh / thành phố"
                name="province"
                value={form.province}
                required
                maxLength={100}
                error={errors.province}
                showCatalogStatus={false}
                onChange={(value) => {
                  touchedProvince.current = true;
                  setForm((previous) => ({ ...previous, province: value }));
                  setErrors((previous) => ({ ...previous, province: "" }));
                }}
              />
            </div>
            <div className="roadmap-searchbar-part is-narrow">
              <VndField
                label="Giá tối đa mỗi món"
                name="maxPrice"
                value={form.maxPrice}
                placeholder="Không giới hạn"
                error={errors.maxPrice}
                onValueChange={(digits) => {
                  setForm((previous) => ({ ...previous, maxPrice: digits }));
                  setErrors((previous) => ({ ...previous, maxPrice: "" }));
                }}
              />
            </div>
          </div>
          <p className="helper roadmap-generate-origin">
            <MapPinIcon aria-hidden />
            {originNote(overview, gpsOrigin)}
          </p>
        </div>
        <TextArea
          label="Ghi chú cho ANGI"
          name="note"
          rows={2}
          className="roadmap-generate-note"
          maxLength={noteMaxLength}
          placeholder="Ví dụ: Ưu tiên món nước"
          value={form.note}
          error={errors.note}
          onChange={(event) => {
            const note = event.target.value;
            setForm((previous) => ({ ...previous, note }));
          }}
        />
        <details className="roadmap-generate-more">
          <summary>
            Tùy chọn thêm
            <span className="helper">
              {" "}
              · {hasOrigin ? "bán kính, " : ""}loại món ưu tiên và cần tránh
            </span>
          </summary>
          <div className="stack">
            {hasOrigin && (
              <Field
                placeholder="Ví dụ: 5"
                label="Bán kính quanh điểm xuất phát (km)"
                name="radiusKm"
                type="number"
                inputMode="decimal"
                min={1}
                max={50}
                step="any"
                value={form.radiusKm}
                error={errors.radiusKm}
                helper="Từ 1 đến 50 km, mặc định 10 km."
                onChange={(event) => {
                  const radiusKm = event.target.value;
                  setForm((previous) => ({ ...previous, radiusKm }));
                  setErrors((previous) => ({ ...previous, radiusKm: "" }));
                }}
              />
            )}
            {tags.length > 0 && (
              <>
                <TagChips
                  label="Ưu tiên các loại món này"
                  tags={tags}
                  pressed={preferred}
                  onToggle={(tag) =>
                    setForm((previous) =>
                      withTagChoice(
                        previous,
                        tag.id,
                        tagChoice(previous, tag.id) === "prefer"
                          ? "none"
                          : "prefer",
                      ),
                    )
                  }
                />
                <TagChips
                  label="Không ăn các loại món này"
                  tags={tags}
                  pressed={avoided}
                  onToggle={(tag) =>
                    setForm((previous) =>
                      withTagChoice(
                        previous,
                        tag.id,
                        tagChoice(previous, tag.id) === "exclude"
                          ? "none"
                          : "exclude",
                      ),
                    )
                  }
                />
              </>
            )}
          </div>
        </details>
        {formError && (
          <div className="stack-sm">
            <Alert>{formError.message}</Alert>
            {formError.inProgress &&
              recallGenerationJob(roadmapId) !== null && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    watch.start(recallGenerationJob(roadmapId)!, null)
                  }
                >
                  Xem tiến trình
                </Button>
              )}
          </div>
        )}
      </form>
    );
  }
  return (
    <Dialog
      open
      wide
      focusField={!defaultProvince.trim() && 'input[name="province"]'}
      title="ANGI lên lịch giúp bạn"
      onClose={() => {
        // Closing while ANGI works only hides the dialog: the job and its badge stay.
        if (phase.kind === "running") onHide();
        else if (!submitting) onClose();
      }}
      footer={footer}
    >
      {content}
    </Dialog>
  );
}
