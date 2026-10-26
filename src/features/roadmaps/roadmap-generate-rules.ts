import { ApiError, getErrorMessage } from "@/shared/api/error";
import { mealSlots } from "./roadmap-add-item-rules";
import { budgetMaxDigits } from "./roadmap-rules";
import type {
  GenerateRoadmapRequestDto,
  GenerationJobDto,
  GenerationScope,
  GenerationStatus,
  MealSlot,
  RoadmapDayDto,
  RoadmapOriginMode,
  RoadmapTagDto,
} from "./roadmap-types";

/** RM-11 is polled every 2–3 seconds (API Design RM-11). */
export const generationPollMs = 2000;
/** After this long the dialog stops waiting; the job keeps running in the backend. */
export const generationMaxWaitMs = 3 * 60 * 1000;
/** Consecutive failed RM-11 reads before the dialog says it cannot follow the job. */
export const maxPollFailures = 3;

/** RM-10 fills breakfast, lunch and dinner unless `mealSlots` says otherwise. */
export const defaultMealSlots: MealSlot[] = ["breakfast", "lunch", "dinner"];
export const defaultRadiusKm = 10;
export const noteMaxLength = 500;

export interface GenerateForm {
  scope: GenerationScope;
  /** The day id as the select keeps it; empty for the whole roadmap. */
  dayId: string;
  /** The one meal of a `slot` generation. */
  mealSlot: MealSlot;
  /** The meals of a `full` or `day` generation. */
  mealSlots: MealSlot[];
  province: string;
  /** Digits only, as the VND input keeps them. */
  maxPrice: string;
  note: string;
  replaceExisting: boolean;
  preferTagIds: number[];
  excludeTagIds: number[];
  radiusKm: string;
}

export function initialGenerateForm(options: {
  scope: GenerationScope;
  dayId: number | null;
  mealSlot: MealSlot;
  province: string;
}): GenerateForm {
  return {
    scope: options.scope,
    dayId: options.dayId === null ? "" : String(options.dayId),
    mealSlot: options.mealSlot,
    mealSlots: [...defaultMealSlots],
    province: options.province,
    maxPrice: "",
    note: "",
    replaceExisting: false,
    preferTagIds: [],
    excludeTagIds: [],
    radiusKm: String(defaultRadiusKm),
  };
}

/** Where a tag stands for the traveler: liked, avoided or untouched. */
export type TagChoice = "prefer" | "exclude" | "none";

export function tagChoice(form: GenerateForm, tagId: number): TagChoice {
  if (form.preferTagIds.includes(tagId)) return "prefer";
  if (form.excludeTagIds.includes(tagId)) return "exclude";
  return "none";
}

/** A tag is either preferred, avoided or neither: never both at once. */
export function withTagChoice(
  form: GenerateForm,
  tagId: number,
  choice: TagChoice,
): GenerateForm {
  const without = (ids: number[]) => ids.filter((id) => id !== tagId);
  return {
    ...form,
    preferTagIds:
      choice === "prefer"
        ? [...without(form.preferTagIds), tagId]
        : without(form.preferTagIds),
    excludeTagIds:
      choice === "exclude"
        ? [...without(form.excludeTagIds), tagId]
        : without(form.excludeTagIds),
  };
}

/** Meal-time tags repeat the meals already chosen above, so only these tags are offered. */
export function preferenceTags(tags: readonly RoadmapTagDto[]) {
  return tags.filter((tag) => tag.tagType !== "meal_time");
}

/** Meals in day order, whatever order the checkboxes were ticked in. */
export function toggleMealSlot(
  selected: readonly MealSlot[],
  slot: MealSlot,
  on: boolean,
): MealSlot[] {
  const next = new Set(selected);
  if (on) next.add(slot);
  else next.delete(slot);
  return mealSlots.filter((entry) => next.has(entry));
}

function parseRadius(text: string) {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) ? value : null;
}

/** Client-side mirror of `GenerateRoadmapRequestDtoValidator`; the backend stays the authority. */
export function validateGenerateForm(
  form: GenerateForm,
  options: { hasOrigin: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.province.trim())
    errors.province = "Chọn tỉnh / thành phố bạn muốn ANGI lấy món.";
  else if (form.province.trim().length > 100)
    errors.province = "Tên tỉnh / thành phố quá dài.";
  if (form.scope !== "full" && !form.dayId) errors.dayId = "Chọn ngày cần tạo.";
  if (form.scope !== "slot" && form.mealSlots.length === 0)
    errors.mealSlots = "Chọn ít nhất một bữa để ANGI tạo.";
  if (form.maxPrice && form.maxPrice.length > budgetMaxDigits)
    errors.maxPrice = "Giá tối đa quá lớn.";
  if (form.note.length > noteMaxLength)
    errors.note = `Ghi chú tối đa ${noteMaxLength} ký tự.`;
  if (options.hasOrigin) {
    const radius = parseRadius(form.radiusKm);
    if (radius === null || radius < 1 || radius > 50)
      errors.radiusKm = "Bán kính từ 1 đến 50 km.";
  }
  return errors;
}

/** Whether RM-10 has a starting point to measure the radius from. */
export function hasGenerationOrigin(
  originMode: RoadmapOriginMode,
  gps: { latitude: number; longitude: number } | undefined,
) {
  return originMode === "pinned" || (originMode === "gps" && gps !== undefined);
}

/**
 * RM-10 body from the form. Empty options are left out; the position is sent only for a `gps`
 * roadmap and always as a pair; the radius only when there is a starting point to measure from.
 */
export function buildGenerateRequest(
  form: GenerateForm,
  options: {
    originMode: RoadmapOriginMode;
    gps?: { latitude: number; longitude: number };
  },
): GenerateRoadmapRequestDto {
  const request: GenerateRoadmapRequestDto = {
    scope: form.scope,
    province: form.province.trim(),
  };
  if (form.scope !== "full") request.dayId = Number(form.dayId);
  if (form.scope === "slot") request.mealSlot = form.mealSlot;
  else request.mealSlots = mealSlots.filter((s) => form.mealSlots.includes(s));
  if (form.replaceExisting) request.replaceExisting = true;
  if (form.maxPrice) request.maxPricePerMeal = Number(form.maxPrice);
  if (form.preferTagIds.length) request.tagIds = [...form.preferTagIds];
  if (form.excludeTagIds.length)
    request.excludeTagIds = [...form.excludeTagIds];
  const note = form.note.trim();
  if (note) request.note = note;
  if (options.originMode === "gps" && options.gps) {
    request.currentLatitude = options.gps.latitude;
    request.currentLongitude = options.gps.longitude;
  }
  if (hasGenerationOrigin(options.originMode, options.gps)) {
    const radius = parseRadius(form.radiusKm);
    if (radius !== null) request.radiusKm = radius;
  }
  return request;
}

/**
 * The dishes `replaceExisting` would delete: those of the covered meals in the covered days.
 * Shown before the traveler confirms; the backend does the deleting.
 */
export function replacedItemCount(
  form: Pick<GenerateForm, "scope" | "dayId" | "mealSlot" | "mealSlots">,
  itinerary: readonly RoadmapDayDto[],
) {
  const covered = (slot: MealSlot) =>
    form.scope === "slot"
      ? slot === form.mealSlot
      : form.mealSlots.includes(slot);
  return itinerary
    .filter((day) => form.scope === "full" || String(day.dayId) === form.dayId)
    .reduce(
      (total, day) =>
        total + day.items.filter((item) => covered(item.mealSlot)).length,
      0,
    );
}

/** What the progress view says about the request, e.g. "Cả lộ trình · Thành phố Hà Nội". */
export function generationSummary(
  form: GenerateForm,
  dayLabel: string,
  mealLabels: Record<MealSlot, string>,
) {
  const scope =
    form.scope === "full"
      ? "Cả lộ trình"
      : form.scope === "day"
        ? dayLabel
        : `${dayLabel} · ${mealLabels[form.mealSlot]}`;
  return `${scope} · ${form.province.trim()}`;
}

export function isGenerationFinished(status: GenerationStatus) {
  return status === "succeeded" || status === "failed";
}

/** The line shown while the job moves from the queue to the finish. */
export function generationStatusText(status: GenerationStatus) {
  switch (status) {
    case "queued":
      return "Đang xếp hàng, ANGI sẽ bắt đầu ngay…";
    case "running":
      return "ANGI đang chọn món và gom các quán gần nhau…";
    case "succeeded":
      return "ANGI đã tạo xong.";
    case "failed":
      return "ANGI chưa tạo được lịch.";
  }
}

/** How many dishes the finished job added (RM-11 `createdItemIds`). */
export function createdItemCount(
  job: Pick<GenerationJobDto, "createdItemIds">,
) {
  return job.createdItemIds.length;
}

/** The line shown once the job succeeded. */
export function generationDoneText(count: number) {
  return count > 0
    ? `ANGI đã thêm ${count} món vào lộ trình. Bạn có thể xem lại và sửa từng món.`
    : "ANGI không thêm món nào vì các bữa trong phạm vi đã có món. Bật “Thay các món đã có” nếu muốn tạo lại.";
}

/** The backend's own words when a job fails (RM-11 `errorMessage`), with a fallback. */
export function generationFailureText(
  job: Pick<GenerationJobDto, "errorMessage">,
) {
  return (
    job.errorMessage?.trim() ||
    "ANGI chưa tạo được lịch. Hãy đổi điều kiện rồi thử lại."
  );
}

/** RM-10 failures by `errorCode`; `inProgress` means another job of this roadmap is running. */
export function generateError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "GENERATION_IN_PROGRESS")
    return {
      inProgress: true,
      message: "Lộ trình này đang được ANGI tạo. Hãy chờ xong rồi thử lại.",
    };
  if (code === "ROADMAP_NOT_FOUND")
    return {
      inProgress: false,
      message: "Không tìm thấy lộ trình này hoặc lộ trình không thuộc về bạn.",
    };
  if (code === "DAY_NOT_FOUND")
    return {
      inProgress: false,
      message:
        "Không tìm thấy ngày này trong lộ trình. Hãy tải lại trang rồi thử lại.",
    };
  if (code === "VALIDATION_FAILED")
    return {
      inProgress: false,
      message:
        "Điều kiện chưa hợp lệ. Kiểm tra tỉnh / thành phố, bữa, giá và bán kính rồi thử lại.",
    };
  return { inProgress: false, message: getErrorMessage(error) };
}

/** RM-11 failures; `missing` means the job is not this roadmap's (or no longer exists). */
export function generationJobError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "JOB_NOT_FOUND")
    return {
      missing: true,
      message: "Không tìm thấy tiến trình tạo lịch này.",
    };
  return { missing: false, message: getErrorMessage(error) };
}
