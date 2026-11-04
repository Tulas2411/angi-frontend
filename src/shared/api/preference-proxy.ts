/**
 * F-17 Set Up Preference Profile: PREF-02 `POST me/preference-survey` (JSON answers) and
 * PREF-03 `POST me/preference-survey/skip` (no body). Both answer 201 and are Traveler-only.
 */
export function preferenceSurveyOperation(method: string, endpoint: string) {
  if (method !== "POST") return null;
  if (endpoint === "me/preference-survey") return { body: true, status: 201 };
  if (endpoint === "me/preference-survey/skip")
    return { body: false, status: 201 };
  return null;
}
