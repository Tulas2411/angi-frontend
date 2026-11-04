import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { SurveyQuestion } from "./survey-questions";

/** PREF-02 body item. `scaleValue` stays in the API for a later slider; this survey leaves it out. */
export interface SurveyAnswerDto {
  optionCode: string;
  scaleValue?: number;
}

/** "Không quan trọng": the question was seen and answered with no preference. */
export const noPreference = "";

/** The chosen option code (or `noPreference`) per question id; a missing id was left out. */
export type SurveySelection = Record<string, string>;

/** BE limit of `answers` (SubmitPreferenceSurveyRequestDtoValidator.MaxAnswers). */
export const maxAnswers = 50;

/** The PREF-02 `answers`: one per chosen option; "Không quan trọng" and left-out questions send nothing. */
export function buildAnswers(
  questions: readonly SurveyQuestion[],
  selection: SurveySelection,
): SurveyAnswerDto[] {
  return questions
    .map((question) => selection[question.id])
    .filter((code): code is string => !!code)
    .map((optionCode) => ({ optionCode }))
    .slice(0, maxAnswers);
}

export const isAnswered = (
  question: SurveyQuestion,
  selection: SurveySelection,
) => selection[question.id] !== undefined;

/** Where a signed-in user lands: a Traveler the reco has no survey for goes to the survey first. */
export function landingAfterSignIn(
  user: { role: string; needsPreferenceSurvey: boolean | null },
  home: string,
) {
  return user.role === "TRAVELER" && user.needsPreferenceSurvey === true
    ? "/survey"
    : home;
}

/** PREF-02 / PREF-03 failures by `errorCode` (sheet "Mã lỗi"). */
export function surveyError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "SURVEY_ALREADY_SUBMITTED")
    return "Bạn đã làm hoặc đã bỏ qua khảo sát này rồi, khảo sát chỉ làm một lần.";
  if (code === "UNKNOWN_OPTION_CODE")
    return "Hệ thống gợi ý chưa nhận ra một số lựa chọn trong khảo sát. Bạn có thể bỏ qua khảo sát và quay lại dùng ANGI bình thường.";
  if (code === "SERVICE_UNAVAILABLE")
    return "Hệ thống gợi ý đang tạm gián đoạn. Câu trả lời của bạn vẫn được giữ, hãy thử gửi lại sau ít phút.";
  if (code === "VALIDATION_FAILED") {
    const first =
      error instanceof ApiError
        ? Object.values(error.errors ?? {}).flat()[0]
        : undefined;
    return first ?? "Câu trả lời khảo sát chưa hợp lệ.";
  }
  if (code === "FORBIDDEN")
    return "Chỉ tài khoản người khám phá mới làm khảo sát khẩu vị.";
  return getErrorMessage(error);
}

export const isAlreadyDone = (error: unknown) =>
  error instanceof ApiError && error.errorCode === "SURVEY_ALREADY_SUBMITTED";
