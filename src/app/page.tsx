import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, readAuth } from "@/features/auth/server";
import { PublicHomePage } from "@/features/discovery/public-home-page";
import { readHomeSelection } from "@/features/discovery/home-content";

export const metadata: Metadata = {
  title: { absolute: "ANGI — Ăn đúng gu. Đi thật đã." },
  description:
    "Khám phá món hợp khẩu vị và lịch trình ẩm thực cho chuyến đi của bạn. Cùng ANGI ăn đúng gu, đi thật đã.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const auth = readAuth(session);
  // Staff and owners land on their workspace; Travelers and guests stay on the homepage.
  if (auth?.user.role === "RESTAURANT_OWNER") redirect("/restaurant");
  if (auth?.user.role === "MOD") redirect("/moderation");
  return (
    <PublicHomePage
      selection={readHomeSelection(params)}
      user={auth?.user ?? null}
    />
  );
}
