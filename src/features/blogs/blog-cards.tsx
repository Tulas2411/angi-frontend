"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/primitives";
import {
  CommentIcon,
  DotsHorizontalIcon,
  HeartIcon,
} from "./blog-icons";
import { blogDate, blogStatusLabels, htmlToText } from "./blog-rules";
import type { BlogCardDto, BlogStatus, MyBlogCardDto } from "./blog-types";

export const blogHref = (blogId: number) => `/guides/${blogId}`;
export const blogEditHref = (blogId: number) => `/guides/${blogId}/edit`;

/**
 * The excerpt of a blog as plain text. The backend sends it as HTML, so its tags
 * are removed here; the cards show a preview, not markup.
 */
function excerptOf(blog: { excerpt: string }) {
  return htmlToText(blog.excerpt);
}

/** The cover of a blog, or a plain tile with the first letter of its title when it has none. */
function Cover({ blog, size }: { blog: BlogCardDto; size: "lead" | "row" | "card" }) {
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

/** Status of one of my blogs: a pale pair on the line under the title. */
export function StatusPill({ status }: { status: BlogStatus }) {
  return (
    <span className={`blog-pill blog-pill-${status}`}>
      {blogStatusLabels[status]}
    </span>
  );
}

/**
 * The menu of a card: one round button with three dots, opened on click and closed
 * when the pointer or the keyboard leaves it.
 */
function CardMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="blog-menu" ref={ref}>
      <button
        type="button"
        className="blog-menu-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        suppressHydrationWarning
      >
        <DotsHorizontalIcon />
      </button>
      {open && (
        <div className="blog-menu-list" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * One blog of the public list, laid out like a social feed: the cover on top, the title
 * with its menu, the excerpt, then the author and the counters on the last line.
 */
export function BlogCard({
  blog,
  lead = false,
  menu,
}: {
  blog: BlogCardDto;
  /** The first blog of the page: a wider cover and a bigger title. */
  lead?: boolean;
  menu?: ReactNode;
}) {
  return (
    <article
      className={`blog-card ${lead ? "blog-card-lead" : ""}`.trim()}
      aria-labelledby={`blog-${blog.id}`}
    >
      <Cover blog={blog} size="card" />
      {menu && (
        <div className="blog-card-menu">
          <CardMenu label={`Tuỳ chọn cho bài ${blog.title}`}>{menu}</CardMenu>
        </div>
      )}
      <div className="blog-card-body">
        <div className="blog-card-title">
          <h2 id={`blog-${blog.id}`}>
            <Link href={blogHref(blog.id)}>{blog.title}</Link>
          </h2>
        </div>
        <p className="blog-excerpt">{excerptOf(blog)}</p>
        {blog.hasRoadmap && <p className="blog-tag">Có lịch ăn đính kèm</p>}
        <div className="blog-card-foot">
          <Byline blog={blog} />
          <Counts blog={blog} />
        </div>
      </div>
    </article>
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
        <p className="blog-excerpt">{excerptOf(blog)}</p>
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
  const mine = "status" in blog;
  return (
    <article
      className={`blog-row ${mine ? "blog-row-mine" : ""}`.trim()}
      aria-labelledby={`blog-${blog.id}`}
    >
      <Cover blog={blog} size="row" />
      <div className="blog-row-text">
        <h3 id={`blog-${blog.id}`}>
          <Link href={blogHref(blog.id)}>{blog.title}</Link>
        </h3>
        {mine ? (
          <p className="blog-row-status">
            <StatusPill status={blog.status} />
          </p>
        ) : (
          <p className="blog-excerpt">{excerptOf(blog)}</p>
        )}
        {"moderationNote" in blog && blog.moderationNote && (
          <p className="blog-note">Lý do kiểm duyệt: {blog.moderationNote}</p>
        )}
        <div className="blog-meta">
          <Byline blog={blog} />
        </div>
      </div>
      <div className="blog-row-counts">
        <Counts blog={blog} />
      </div>
      {actions && <div className="blog-row-actions">{actions}</div>}
    </article>
  );
}
