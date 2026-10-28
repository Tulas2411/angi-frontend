import {
  buildCreateRoadmapRequest,
  emptyRoadmapForm,
  roadmapLimits,
  suggestRoadmapTitle,
  validateRoadmapForm,
} from "@/features/roadmaps/roadmap-rules";

export interface HomeRoadmapValues {
  province: string;
  startDate: string;
  numDays: string;
}
export const emptyHomeRoadmap: HomeRoadmapValues = {
  province: "",
  startDate: "",
  numDays: "3",
};

function roadmapValues(values: HomeRoadmapValues) {
  return {
    ...emptyRoadmapForm,
    ...values,
    title: suggestRoadmapTitle(values.province, values.numDays),
    originMode: "none" as const,
  };
}
/** Reuse the planner's app limit (1–7 days); RM-01 itself supports 1–30. */
export function validateHomeRoadmap(values: HomeRoadmapValues) {
  const original = validateRoadmapForm(roadmapValues(values), null);
  const errors: Record<string, string> = {};
  if (original.province) errors.province = original.province;
  if (values.province.trim().length > 100)
    errors.province = "Tên tỉnh/thành tối đa 100 ký tự.";
  if (!values.startDate) errors.startDate = "Chọn ngày bắt đầu chuyến đi.";
  else if (original.startDate) errors.startDate = original.startDate;
  if (original.numDays) errors.numDays = original.numDays;
  return errors;
}
export const homeRoadmapDayLimit = roadmapLimits.maxDays;
export function homeRoadmapRequest(values: HomeRoadmapValues) {
  return buildCreateRoadmapRequest(roadmapValues(values), null);
}

export const homeRoadmapDraftKey = "angi:home-roadmap-draft";
/** Only the three non-secret form values survive the guest's trip through login. */
export function readHomeRoadmapDraft(): string {
  try {
    return sessionStorage.getItem(homeRoadmapDraftKey) ?? "";
  } catch {
    return "";
  }
}
export function parseHomeRoadmapDraft(raw: string): HomeRoadmapValues | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("province" in value) ||
      !("startDate" in value) ||
      !("numDays" in value) ||
      typeof value.province !== "string" ||
      typeof value.startDate !== "string" ||
      typeof value.numDays !== "string"
    )
      return null;
    const values = {
      province: value.province,
      startDate: value.startDate,
      numDays: value.numDays,
    };
    return Object.keys(validateHomeRoadmap(values)).length ? null : values;
  } catch {
    return null;
  }
}
export function saveHomeRoadmapDraft(values: HomeRoadmapValues): boolean {
  try {
    sessionStorage.setItem(homeRoadmapDraftKey, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}
export function clearHomeRoadmapDraft() {
  try {
    sessionStorage.removeItem(homeRoadmapDraftKey);
  } catch {
    /* Storage is optional after a successful creation. */
  }
}
