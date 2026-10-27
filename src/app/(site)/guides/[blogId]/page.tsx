import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readSessionUser } from "@/features/auth/server";
import {
  BlogDetailPage,
  type BlogViewer,
} from "@/features/blogs/blog-detail-page";
import { parseBlogId } from "@/features/blogs/blog-rules";

export const metadata: Metadata = { title: "Chi tiết cẩm nang" };

export default async function Page({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const blogId = parseBlogId((await params).blogId);
  if (blogId === null) notFound();
  const user = await readSessionUser();
  // Likes, comments and reports are Traveler-only; other roles read the blog.
  const viewer: BlogViewer = !user
    ? "GUEST"
    : user.role === "TRAVELER"
      ? "TRAVELER"
      : "OTHER";
  return <BlogDetailPage blogId={blogId} viewer={viewer} />;
}
