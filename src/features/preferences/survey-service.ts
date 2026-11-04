import { api } from "@/shared/api/client";
import type { SurveyAnswerDto } from "./survey-rules";

export interface SubmitPreferenceSurveyResponseDto {
  completed: boolean;
  answerCount: number;
  hasVector: boolean;
}

export interface SkipPreferenceSurveyResponseDto {
  completed: boolean;
  skipped: boolean;
}

/** F-17 through the same-origin proxy (Traveler sessions). */
export interface PreferenceSurveyService {
  /** ME-01 `preferenceStatus`: completed | skipped | null (not done, or reco unavailable). */
  status(): Promise<"completed" | "skipped" | null>;
  /** PREF-02: once; reco turns the answers into the starting taste vector. */
  submit(
    answers: SurveyAnswerDto[],
  ): Promise<SubmitPreferenceSurveyResponseDto>;
  /** PREF-03: once; the survey can no longer be taken. */
  skip(): Promise<SkipPreferenceSurveyResponseDto>;
  /** AUTH-05 through the BFF, so the session's `needsPreferenceSurvey` is read again. */
  refreshSession(): Promise<unknown>;
}

export const preferenceSurveyService: PreferenceSurveyService = {
  status: async () => {
    const me = await api.get<{ preferenceStatus: string | null }>("me");
    return me.preferenceStatus === "completed" ||
      me.preferenceStatus === "skipped"
      ? me.preferenceStatus
      : null;
  },
  submit: (answers) =>
    api.post<SubmitPreferenceSurveyResponseDto>("me/preference-survey", {
      answers,
    }),
  skip: () =>
    api.post<SkipPreferenceSurveyResponseDto>("me/preference-survey/skip"),
  refreshSession: () => api.refresh(),
};
