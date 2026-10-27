import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/primitives";
import { CommentIcon, HeartIcon } from "./blog-icons";
import { blogDate, blogStatusLabels } from "./blog-rules";
import type { BlogCardDto, BlogStatus, MyBlogCardDto } from "./blog-types";

export const blogHref = (blogId: number) => `/guides/${blogId}`;
export const blogEditHref = (blogId: number) => `/guides/${blogId}/edit`;

/** The cover of a blog, or a plain tile with the first letter of its title when it has none. */
function Cover({ blog, size }: { blog: BlogCardDto; size: "lead" | "row" }) {
  return blog.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`blog-cover blog-cover-${size}`}
      src={blog.coverUrl}
      alt=""
      loading="lazy"
    />
  ) : (
    <span
      className={`blog-cover blog-cover-${size} blog-cover-none`}
      aria-hidden
    >
      {blog.title.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Counts({ blog }: { blog: BlogCardDto }) {
  return (
    <span className="blog-counts">
      <span aria-label={`${blog.likeCount} lượt thích`}>
        <HeartIcon />
        {blog.likeCount}
      </span>
      <span aria-label={`${blog.commentCount} bình luận`}>
        <CommentIcon />
        {blog.commentCount}
      </span>
    </span>
  );
}

function Byline({ blog }: { blog: BlogCardDto }) {
  return (
    <p className="blog-byline">
      <Avatar name={blog.author.displayName} image={blog.author.avatarUrl} />
      <span>{blog.author.displayName}</span>
      <span aria-hidden>·</span>
      <span>{blogDate(blog.publishedAt)}</span>
    </p>
  );
}

/** Status of one of my blogs: a pale pair beside the title, never above it. */
export function StatusPill({ status }: { status: BlogStatus }) {
  return (
    <span className={`blog-pill blog-pill-${status}`}>
      {blogStatusLabels[status]}
    </span>
  );
}

/** The first blog of a page: the cover on the left, the story on the right. */
export function BlogLead({ blog }: { blog: BlogCardDto }) {
  return (
    <article
      className={`blog-lead ${blog.coverUrl ? "" : "blog-lead-plain"}`.trim()}
      aria-labelledby={`blog-${blog.id}`}
    >
      {blog.coverUrl && <Cover blog={blog} size="lead" />}
      <div className="blog-lead-text">
        <h2 id={`blog-${blog.id}`}>
          <Link href={blogHref(blog.id)}>{blog.title}</Link>
        </h2>
        <p className="blog-excerpt">{blog.excerpt}</p>
        <div className="blog-meta">
          <Byline blog={blog} />
          <Counts blog={blog} />
        </div>
        {blog.hasRoadmap && <p className="blog-tag">Có lịch ăn đính kèm</p>}
      </div>
    </article>
  );
}

/** One blog of a list: a thumbnail, the title with its excerpt, who wrote it and what it drew. */
export function BlogRow({
  blog,
  actions,
}: {
  blog: BlogCardDto | MyBlogCardDto;
  actions?: ReactNode;
}) {
  return (
    <article className="blog-row" aria-labelledby={`blog-${blog.id}`}>
      <Cover blog={blog} size="row" />
      <div className="blog-row-text">
        <div className="blog-row-top">
          <h3 id={`blog-${blog.id}`}>
            <Link href={blogHref(blog.id)}>{blog.title}</Link>
          </h3>
          {"status" in blog && <StatusPill status={blog.status} />}
        </div>
        <p className="blog-excerpt">{blog.excerpt}</p>
        {"moderationNote" in blog && blog.moderationNote && (
          <p className="blog-note">Lý do kiểm duyệt: {blog.moderationNote}</p>
        )}
        <div className="blog-meta">
          <Byline blog={blog} />
          <Counts blog={blog} />
        </div>
      </div>
      {actions && <div className="blog-row-actions">{actions}</div>}
    </article>
  );
}
