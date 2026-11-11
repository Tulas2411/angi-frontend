import type { Metadata } from "next";
import { requireUser } from "@/features/auth/server";
import { BlogEditorPage } from "@/features/blogs/blog-editor-page";
import { parseBlogId } from "@/features/blogs/blog-rules";

export const metadata: Metadata = { title: "Viết cẩm nang" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ roadmap?: string | string[] }>;
}) {
  // BLOG-04 is a Traveler-only operation.
  await requireUser(["TRAVELER"]);
  const { roadmap } = await searchParams;
  // `?roadmap=88` comes from "Chia sẻ lộ trình" (Share My Roadmap).
  return (
    <BlogEditorPage
      roadmapId={parseBlogId(
        Array.isArray(roadmap) ? roadmap[0] : (roadmap ?? ""),
      )}
    />
  );
}
