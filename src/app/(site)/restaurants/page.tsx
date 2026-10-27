import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { RestaurantListPage } from "@/features/explore/restaurant-list-page";

export const metadata: Metadata = { title: "Khám phá quán ăn" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <RestaurantListPage />
    </Suspense>
  );
}
