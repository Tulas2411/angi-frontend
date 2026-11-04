import { describe, expect, it } from "vitest";
import { surveyQuestions } from "@/features/preferences/survey-questions";
import {
  buildAnswers,
  isAlreadyDone,
  isAnswered,
  landingAfterSignIn,
  maxAnswers,
  noPreference,
  surveyError,
} from "@/features/preferences/survey-rules";
import { preferenceSurveyOperation } from "@/shared/api/preference-proxy";
import { ApiError } from "@/shared/api/error";

/** The 27 rows of recommendation.survey_option_vectors (angi-reco Preference_Survey_Ver1.0). */
const recoCodes = [
  "spicy_none",
  "spicy_mild",
  "spicy_medium",
  "spicy_hot",
  "spicy_very_hot",
  "sweet_low",
  "sweet_medium",
  "sweet_high",
  "sour_low",
  "sour_medium",
  "sour_high",
  "salty_low",
  "salty_medium",
  "salty_high",
  "broth_light",
  "broth_rich",
  "fatty_low",
  "fatty_medium",
  "fatty_high",
  "herbs_none",
  "herbs_some",
  "herbs_lots",
  "bitter_avoid",
  "bitter_ok",
  "bitter_like",
  "cool_light",
  "warm_hearty",
];

describe("F-17 questions", () => {
  it("offer exactly the option codes reco knows, in the documented 9 questions", () => {
    expect(surveyQuestions).toHaveLength(9);
    const codes = surveyQuestions.flatMap((question) =>
      question.options.map((option) => option.code),
    );
    expect([...codes].sort()).toEqual([...recoCodes].sort());
  });
});

describe("F-17 answers", () => {
  it("sends one optionCode per chosen option and nothing for 'Không quan trọng'", () => {
    expect(
      buildAnswers(surveyQuestions, {
        spicy: "spicy_medium",
        broth: "broth_rich",
        sweet: noPreference,
        herbs: "herbs_lots",
      }),
    ).toEqual([
      { optionCode: "spicy_medium" },
      { optionCode: "broth_rich" },
      { optionCode: "herbs_lots" },
    ]);
    expect(buildAnswers(surveyQuestions, {})).toEqual([]);
    expect(
      buildAnswers(surveyQuestions, {
        spicy: noPreference,
        sour: noPreference,
      }),
    ).toEqual([]);
  });

  it("never sends scaleValue and stays within 1..50 answers", () => {
    const everything = Object.fromEntries(
      surveyQuestions.map((question) => [
        question.id,
        question.options[0].code,
      ]),
    );
    const answers = buildAnswers(surveyQuestions, everything);
    expect(answers).toHaveLength(9);
    expect(answers.length).toBeLessThanOrEqual(maxAnswers);
    expect(answers.some((answer) => "scaleValue" in answer)).toBe(false);
  });

  it("counts 'Không quan trọng' as answered, a left-out question as not", () => {
    const spicy = surveyQuestions[0];
    expect(isAnswered(spicy, {})).toBe(false);
    expect(isAnswered(spicy, { spicy: noPreference })).toBe(true);
    expect(isAnswered(spicy, { spicy: "spicy_hot" })).toBe(true);
  });
});

describe("F-17 flow", () => {
  it("sends a Traveler the reco has no survey for to /survey after sign-in", () => {
    expect(
      landingAfterSignIn(
        { role: "TRAVELER", needsPreferenceSurvey: true },
        "/",
      ),
    ).toBe("/survey");
    expect(
      landingAfterSignIn(
        { role: "TRAVELER", needsPreferenceSurvey: null },
        "/",
      ),
    ).toBe("/");
    expect(
      landingAfterSignIn(
        { role: "MOD", needsPreferenceSurvey: true },
        "/moderation",
      ),
    ).toBe("/moderation");
  });

  it("words the codes of the Mã lỗi sheet", () => {
    const done = new ApiError(409, "SURVEY_ALREADY_SUBMITTED", "x");
    expect(isAlreadyDone(done)).toBe(true);
    expect(surveyError(done)).toContain("chỉ làm một lần");
    expect(
      surveyError(new ApiError(503, "SERVICE_UNAVAILABLE", "x")),
    ).toContain("vẫn được giữ");
    expect(
      surveyError(new ApiError(400, "UNKNOWN_OPTION_CODE", "x")),
    ).toContain("chưa nhận ra");
  });

  it("lets exactly PREF-02 and PREF-03 through the proxy", () => {
    expect(preferenceSurveyOperation("POST", "me/preference-survey")).toEqual({
      body: true,
      status: 201,
    });
    expect(
      preferenceSurveyOperation("POST", "me/preference-survey/skip"),
    ).toEqual({ body: false, status: 201 });
    expect(preferenceSurveyOperation("GET", "me/preference-survey")).toBeNull();
    expect(
      preferenceSurveyOperation("POST", "me/preference-survey/redo"),
    ).toBeNull();
  });
});
