import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { PreferenceSurveyPage } from "@/features/preferences/survey-page";

export const metadata: Metadata = { title: "Khảo sát khẩu vị" };

export default async function Page() {
  // PREF-02 / PREF-03 are Traveler-only operations.
  await requireUser(["TRAVELER"]);
  return <PreferenceSurveyPage />;
}
