/**
 * F-17 preference survey questions (API Design v1.8: "câu hỏi hardcode ở frontend").
 *
 * Source of truth: `angi-reco/docs/Preference_Survey_Ver1.0.md`, whose option codes are the rows of
 * `recommendation.survey_option_vectors` (reco migration `0002`). Every question is single choice; each
 * also offers "Không quan trọng", which sends no answer. `scaleValue` is not used by this version.
 * A code reco does not know is answered with 400 UNKNOWN_OPTION_CODE, so change codes only with reco.
 */

export interface SurveyOption {
  code: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  options: SurveyOption[];
}

export const surveyQuestions: SurveyQuestion[] = [
  {
    id: "spicy",
    title: "Bạn ăn cay đến mức nào?",
    options: [
      { code: "spicy_none", label: "Không ăn cay" },
      { code: "spicy_mild", label: "Cay nhẹ" },
      { code: "spicy_medium", label: "Cay vừa" },
      { code: "spicy_hot", label: "Cay nhiều" },
      { code: "spicy_very_hot", label: "Rất cay" },
    ],
  },
  {
    id: "sweet",
    title: "Bạn thích món ngọt đến mức nào?",
    options: [
      { code: "sweet_low", label: "Ít ngọt" },
      { code: "sweet_medium", label: "Ngọt vừa" },
      { code: "sweet_high", label: "Ngọt đậm" },
    ],
  },
  {
    id: "sour",
    title: "Bạn thích vị chua đến mức nào?",
    options: [
      { code: "sour_low", label: "Ít chua" },
      { code: "sour_medium", label: "Chua vừa" },
      { code: "sour_high", label: "Chua nhiều" },
    ],
  },
  {
    id: "salty",
    title: "Bạn ăn mặn đến mức nào?",
    options: [
      { code: "salty_low", label: "Ăn nhạt" },
      { code: "salty_medium", label: "Mặn vừa" },
      { code: "salty_high", label: "Ăn mặn" },
    ],
  },
  {
    id: "broth",
    title: "Bạn thích nước dùng thế nào?",
    options: [
      { code: "broth_light", label: "Thanh, trong" },
      { code: "broth_rich", label: "Đậm đà, ngọt thịt" },
    ],
  },
  {
    id: "fatty",
    title: "Bạn thích món béo đến mức nào?",
    options: [
      { code: "fatty_low", label: "Ít béo" },
      { code: "fatty_medium", label: "Béo vừa" },
      { code: "fatty_high", label: "Béo nhiều (mỡ, nước cốt dừa, bơ)" },
    ],
  },
  {
    id: "herbs",
    title: "Bạn thích rau thơm, gia vị thơm không?",
    options: [
      { code: "herbs_none", label: "Không thích" },
      { code: "herbs_some", label: "Một chút" },
      { code: "herbs_lots", label: "Càng nhiều càng tốt" },
    ],
  },
  {
    id: "bitter",
    title: "Bạn có ăn được vị đắng, chát (khổ qua, lá chát, trà)?",
    options: [
      { code: "bitter_avoid", label: "Tránh" },
      { code: "bitter_ok", label: "Ăn được" },
      { code: "bitter_like", label: "Thích" },
    ],
  },
  {
    id: "warmth",
    title: "Bạn thích món thanh mát hay ấm nóng, đậm vị?",
    options: [
      { code: "cool_light", label: "Thanh mát" },
      { code: "warm_hearty", label: "Ấm nóng, đậm vị" },
    ],
  },
];
