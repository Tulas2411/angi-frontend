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
import { mealSlots, provinceFromText } from "./roadmap-add-item-rules";
import { dayTitle, mealSlotLabels } from "./roadmap-detail-rules";
import {
  buildGenerateRequest,
  createdItemCount,
  defaultRadiusKm,
  generateError,
  generationDoneText,
  generationFailureText,
  generationJobError,
  generationMaxWaitMs,
  generationPollMs,
  generationStatusText,
  generationSummary,
  hasGenerationOrigin,
  maxPollFailures,
  noteMaxLength,
  preferenceTags,
  replacedItemCount,
  tagChoice,
  toggleMealSlot,
  validateGenerateForm,
  withTagChoice,
  type GenerateForm,
} from "./roadmap-generate-rules";
import {
  forgetGenerationJob,
  recallGenerationJob,
  rememberGenerationJob,
} from "./roadmap-generation-job";
import { rememberDestination } from "./roadmap-destination";
import type { RoadmapGenerationService } from "./roadmap-service";
import type {
  GenerationJobDto,
  GenerationScope,
  MealSlot,
  RoadmapDayDto,
  RoadmapSummaryDto,
  RoadmapTagDto,
} from "./roadmap-types";
import { VndField } from "./vnd-field";
import "./roadmap-generate.css";

type Phase =
  | { kind: "form" }
  | { kind: "running"; jobId: number }
  | { kind: "done"; job: GenerationJobDto; reloadFailed: boolean }
  | { kind: "failed"; message: string };

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
  onGenerated,
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
  /** The job succeeded: the parent reloads the roadmap (RM-03); rejects when that fails. */
  onGenerated: () => Promise<void>;
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
  // A job started before the dialog was closed is followed again instead of queued twice.
  const [remembered] = useState(() => recallGenerationJob(roadmapId));
  const [phase, setPhase] = useState<Phase>(
    remembered ? { kind: "running", jobId: remembered } : { kind: "form" },
  );
  const firstLook = useRef(remembered !== null);
  const [job, setJob] = useState<GenerationJobDto | null>(null);
  const [stalled, setStalled] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [tags, setTags] = useState<RoadmapTagDto[]>([]);
  const mounted = useRef(true);
  const touchedProvince = useRef(false);
  // What was asked, for the progress line; unknown when a remembered job is followed again.
  const [submitted, setSubmitted] = useState<GenerateForm | null>(null);

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

  // Follow the job: RM-11 every 2–3 s until it finishes, stops answering, or takes too long.
  const jobId = phase.kind === "running" ? phase.jobId : null;
  useEffect(() => {
    if (jobId === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const started = Date.now();

    function later() {
      if (Date.now() - started >= generationMaxWaitMs) {
        setStalled(
          "ANGI đang tạo lâu hơn dự kiến. Bạn có thể đóng hộp này, lịch sẽ xuất hiện khi xong và ANGI sẽ gửi thông báo.",
        );
        return;
      }
      timer = setTimeout(poll, generationPollMs);
    }
    async function poll() {
      try {
        const current = await service.generationJob(roadmapId, jobId!);
        if (cancelled) return;
        failures = 0;
        setJob(current);
        if (current.status === "succeeded") {
          forgetGenerationJob(roadmapId);
          let reloadFailed = false;
          try {
            await onGenerated();
          } catch {
            reloadFailed = true;
          }
          if (!cancelled)
            setPhase({ kind: "done", job: current, reloadFailed });
        } else if (current.status === "failed") {
          forgetGenerationJob(roadmapId);
          setPhase({ kind: "failed", message: generationFailureText(current) });
        } else later();
      } catch (caught) {
        if (cancelled) return;
        const failure = generationJobError(caught);
        if (failure.missing) {
          forgetGenerationJob(roadmapId);
          setPhase({ kind: "failed", message: failure.message });
        } else if (++failures >= maxPollFailures)
          setStalled(
            `Chưa kiểm tra được tiến trình: ${failure.message} ANGI vẫn tiếp tục tạo ở nền.`,
          );
        else later();
      }
    }
    // A remembered job may already be finished: look at once, then every poll interval.
    timer = setTimeout(poll, firstLook.current ? 0 : generationPollMs);
    firstLook.current = false;
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `onGenerated` and `service` are stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, round]);

  const hasOrigin = hasGenerationOrigin(overview.originMode, gpsOrigin);
  const replacing = replacedItemCount(form, itinerary);
  const day = itinerary.find((entry) => String(entry.dayId) === form.dayId);

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
      setSubmitted(form);
      rememberGenerationJob(roadmapId, queued.jobId);
      rememberDestination(roadmapId, form.province);
      setJob(null);
      setStalled(null);
      setPhase({ kind: "running", jobId: queued.jobId });
    } catch (caught) {
      if (mounted.current) setFormError(generateError(caught));
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  const replaceNow = form.replaceExisting && replacing > 0;
  const footer =
    // Each phase's buttons have their own key: React must not reuse the button that was just
    // clicked ("Chỉnh điều kiện") as the next phase's submit button, or that same click submits.
    phase.kind === "form" ? (
      <Fragment key="form">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button
          type="submit"
          form={formId}
          variant={replaceNow ? "destructive" : "primary"}
          loading={submitting}
        >
          {replaceNow ? "Xóa món cũ và tạo lại" : "Tạo lịch bằng AI"}
        </Button>
      </Fragment>
    ) : phase.kind === "running" ? (
      <Fragment key="running">
        {stalled && (
          <Button
            variant="secondary"
            onClick={() => {
              setStalled(null);
              setRound((value) => value + 1);
            }}
          >
            Kiểm tra lại
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Đóng, ANGI vẫn tạo ở nền
        </Button>
      </Fragment>
    ) : phase.kind === "done" ? (
      <Button key="done" onClick={onClose}>
        Xem lộ trình
      </Button>
    ) : (
      <Fragment key="failed">
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
        <Button onClick={() => setPhase({ kind: "form" })}>
          Chỉnh điều kiện
        </Button>
      </Fragment>
    );

  let content: ReactNode;
  if (phase.kind === "running") {
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
    content = (
      <div className="roadmap-generate-progress stack" aria-live="polite">
        <div className="roadmap-generate-status">
          {!stalled && <span className="spinner" aria-hidden />}
          <p role="status">
            <strong>
              {stalled ?? generationStatusText(job?.status ?? "queued")}
            </strong>
          </p>
        </div>
        {summary && <p className="helper">{summary}</p>}
        <ol className="roadmap-generate-steps" aria-label="Tiến trình">
          <li data-state={job?.status === "running" ? "done" : "active"}>
            Xếp hàng
          </li>
          <li data-state={job?.status === "running" ? "active" : "todo"}>
            Chọn món và gom quán gần nhau
          </li>
          <li data-state="todo">Ghi vào lộ trình</li>
        </ol>
        <p className="helper">
          Việc này thường mất vài giây. Bạn có thể đóng hộp này, ANGI sẽ gửi
          thông báo khi xong.
        </p>
      </div>
    );
  } else if (phase.kind === "done")
    content = (
      <div className="stack">
        <Alert tone="success">
          {generationDoneText(createdItemCount(phase.job))}
        </Alert>
        {phase.reloadFailed && (
          <Alert tone="warning">
            Lịch đã được tạo nhưng chưa tải lại được lộ trình. Hãy đóng hộp này
            rồi tải lại trang để xem đầy đủ.
          </Alert>
        )}
      </div>
    );
  else if (phase.kind === "failed")
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
          ANGI chọn món hợp với bạn, mỗi bữa một món, và gom các quán gần nhau
          trong cùng một ngày. Bạn xem lại toàn bộ rồi sửa từng món nếu muốn.
        </p>
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
          <div className="roadmap-generate-row">
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
            {form.scope === "slot" && (
              <SelectField
                label="Bữa"
                name="mealSlot"
                value={form.mealSlot}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    mealSlot: value as MealSlot,
                  }))
                }
                options={mealSlots.map((slot) => ({
                  value: slot,
                  label: mealSlotLabels[slot],
                }))}
              />
            )}
          </div>
        )}
        <div className="roadmap-generate-row">
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
        {form.scope !== "slot" && (
          <fieldset className="roadmap-generate-meals">
            <legend>Các bữa ANGI cần tạo</legend>
            <div className="roadmap-generate-chips">
              {mealSlots.map((slot) => (
                <Choice
                  key={slot}
                  label={mealSlotLabels[slot]}
                  checked={form.mealSlots.includes(slot)}
                  onChange={(checked) => {
                    setForm((previous) => ({
                      ...previous,
                      mealSlots: toggleMealSlot(
                        previous.mealSlots,
                        slot,
                        checked,
                      ),
                    }));
                    setErrors((previous) => ({ ...previous, mealSlots: "" }));
                  }}
                />
              ))}
            </div>
            {errors.mealSlots && (
              <p className="field-error" role="alert">
                {errors.mealSlots}
              </p>
            )}
          </fieldset>
        )}
        <TextArea
          label="Ghi chú cho ANGI"
          name="note"
          rows={2}
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
          <summary>Tùy chọn thêm</summary>
          <div className="stack">
            {hasOrigin && (
              <Field
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
        <p className="helper">{originNote(overview, gpsOrigin)}</p>
        <div className="roadmap-generate-replace stack-sm">
          <Choice
            label="Thay các món đã có trong phạm vi"
            checked={form.replaceExisting}
            onChange={(checked) =>
              setForm((previous) => ({ ...previous, replaceExisting: checked }))
            }
          />
          {form.replaceExisting ? (
            <Alert tone="warning">
              {replacing > 0
                ? `ANGI sẽ xóa ${replacing} món đang có${form.scope === "full" ? "" : ` của ${day ? dayTitle(day) : "ngày này"}`} ở các bữa đã chọn rồi tạo lại. Không hoàn tác được.`
                : "Chưa có món nào trong phạm vi này, nên không có gì bị xóa."}
            </Alert>
          ) : (
            <p className="helper">
              Mặc định ANGI chỉ điền các bữa còn trống và giữ nguyên món đã có.
            </p>
          )}
        </div>
        {formError && (
          <div className="stack-sm">
            <Alert>{formError.message}</Alert>
            {formError.inProgress &&
              recallGenerationJob(roadmapId) !== null && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setPhase({
                      kind: "running",
                      jobId: recallGenerationJob(roadmapId)!,
                    })
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
      focusField={!defaultProvince.trim()}
      title="ANGI lên lịch giúp bạn"
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={footer}
    >
      {content}
    </Dialog>
  );
}
