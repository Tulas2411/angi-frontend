import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { readSessionUser } from "@/features/auth/server";
import { BlogListPage } from "@/features/blogs/blog-list-page";

export const metadata: Metadata = { title: "Cẩm nang ẩm thực" };

export default async function Page() {
  const user = await readSessionUser();
  const traveler = user?.role === "TRAVELER" ? user : null;
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <BlogListPage signedIn={Boolean(traveler)} viewerId={traveler?.id ?? null} />
    </Suspense>
  );
}
