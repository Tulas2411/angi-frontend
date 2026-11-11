import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { DishListPage } from "@/features/explore/dish-list-page";
import { readSessionUser } from "@/features/auth/server";
import type { PlanBannerAudience } from "@/features/explore/plan-roadmap-banner";

export const metadata: Metadata = { title: "Khám phá món ăn" };

export default async function Page() {
  // The plan-a-roadmap banner: Travelers plan at once, guests are invited to join, staff never see it.
  const user = await readSessionUser();
  const planAudience: PlanBannerAudience | null = !user
    ? "guest"
    : user.role === "TRAVELER"
      ? "traveler"
      : null;
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <DishListPage planAudience={planAudience} />
    </Suspense>
  );
}
