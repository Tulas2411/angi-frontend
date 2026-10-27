import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DishDetailPage } from "@/features/explore/dish-detail-page";
import { parseEntityId } from "@/features/explore/explore-rules";

export const metadata: Metadata = { title: "Chi tiết món ăn" };

export default async function Page({
  params,
}: {
  params: Promise<{ dishId: string }>;
}) {
  const dishId = parseEntityId((await params).dishId);
  if (dishId === null) notFound();
  return <DishDetailPage dishId={dishId} />;
}
