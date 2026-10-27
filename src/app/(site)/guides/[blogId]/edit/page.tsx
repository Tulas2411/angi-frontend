import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/server";
import { BlogEditorPage } from "@/features/blogs/blog-editor-page";
import { parseBlogId } from "@/features/blogs/blog-rules";

export const metadata: Metadata = { title: "Chỉnh sửa cẩm nang" };

export default async function Page({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  // BLOG-06 is a Traveler-only operation.
  await requireUser(["TRAVELER"]);
  const blogId = parseBlogId((await params).blogId);
  if (blogId === null) notFound();
  return <BlogEditorPage blogId={blogId} />;
}
