import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/features/auth/server";
import { MyBlogsPage } from "@/features/blogs/my-blogs-page";

export const metadata: Metadata = { title: "Bài viết của tôi" };

export default async function Page() {
  // BLOG-05 is a Traveler-only operation.
  await requireUser(["TRAVELER"]);
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <MyBlogsPage />
    </Suspense>
  );
}
