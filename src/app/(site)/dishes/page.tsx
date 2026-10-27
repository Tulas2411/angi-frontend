import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { DishListPage } from "@/features/explore/dish-list-page";

export const metadata: Metadata = { title: "Khám phá món ăn" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <DishListPage />
    </Suspense>
  );
}
