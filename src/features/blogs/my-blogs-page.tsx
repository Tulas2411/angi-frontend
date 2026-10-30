"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Tabs,
} from "@/components/ui/primitives";
import { useRemote } from "@/features/explore/use-remote";
import { BlogRow, blogEditHref } from "./blog-cards";
import { PencilIcon, TrashIcon } from "./blog-icons";
import { BlogHeading, BlogProblem, BlogSkeleton } from "./blog-layout";
import {
  blogError,
  blogPageSize,
  blogStatusTabs,
  mineHref,
} from "./blog-rules";
import { blogService, type BlogService } from "./blog-service";
import type { BlogStatus, MyBlogCardDto } from "./blog-types";
import "./blogs.css";

function statusFromParam(value: string | null): "" | BlogStatus {
  return value === "published" || value === "hidden" || value === "removed"
    ? value
    : "";
}

/** F-35 View My Blog: BLOG-05 with a status tab, edit (BLOG-06) and delete (BLOG-07). */
export function MyBlogsPage({
  service = blogService,
}: {
  service?: BlogService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const status = statusFromParam(params.get("status"));
  const pageParam = Number(params.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () =>
      service.mine({
        status: status || undefined,
        page,
        pageSize: blogPageSize,
      }),
    `${status}:${page}:${version}`,
  );
  const [removing, setRemoving] = useState<MyBlogCardDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const deleting = useRef(false);

  async function confirmRemove() {
    if (!removing || deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setProblem("");
    const target = removing;
    try {
      await service.remove(target.id);
      setNotice(`Đã xóa “${target.title}”.`);
      setRemoving(null);
      setVersion((value) => value + 1);
    } catch (caught) {
      const failure = blogError(caught);
      if (failure.gone) {
        setNotice(
          `“${target.title}” không còn nữa. Danh sách đã được cập nhật.`,
        );
        setRemoving(null);
        setVersion((value) => value + 1);
      } else setProblem(failure.message);
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  }

  const ready = state.status === "ready" ? state.data : null;
  const tabLabel = blogStatusTabs.find((tab) => tab.value === status)?.label;
  const heading = (
    <BlogHeading
      title="Bài viết của tôi"
      line={
        ready
          ? ready.totalItems === 0
            ? "Chưa có bài nào ở mục này"
            : `${ready.totalItems} bài${status ? ` ${tabLabel?.toLowerCase()}` : ""}, kể cả bài bị kiểm duyệt viên ẩn hoặc gỡ`
          : "Các bài bạn đã đăng"
      }
      actions={
        <>
          <Link className="button button-secondary" href="/guides">
            Cẩm nang
          </Link>
          <ActionLink href="/guides/new">Viết cẩm nang</ActionLink>
        </>
      }
    />
  );
  const tabs = (
    <Tabs
      label="Trạng thái bài viết"
      value={status}
      onChange={(value) => router.push(mineHref(value as "" | BlogStatus, 1))}
      items={blogStatusTabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
      }))}
    />
  );

  if (state.status === "loading")
    return (
      <div className="blog-page">
        {heading}
        {tabs}
        <BlogSkeleton rows={4} />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="blog-page">
        {heading}
        {tabs}
        <BlogProblem
          title="Chưa tải được bài viết của bạn"
          error={state.error}
          onRetry={retry}
        />
      </div>
    );
  const { data } = state;
  return (
    <div className="blog-page">
      {heading}
      {tabs}
      {notice && <Alert tone="success">{notice}</Alert>}
      {data.totalItems === 0 ? (
        <EmptyState
          title={
            status ? "Không có bài ở trạng thái này" : "Bạn chưa có bài viết"
          }
          action={<ActionLink href="/guides/new">Viết cẩm nang</ActionLink>}
        >
          Chia sẻ món ngon và trải nghiệm của bạn với cộng đồng.
        </EmptyState>
      ) : (
        <ul className="blog-rows blog-rows-one">
          {data.items.map((blog) => (
            <li key={blog.id}>
              <BlogRow
                blog={blog}
                actions={
                  <>
                    {blog.status !== "removed" && (
                      <Link
                        className="blog-icon-action"
                        href={blogEditHref(blog.id)}
                        aria-label={`Chỉnh sửa bài ${blog.title}`}
                        title="Chỉnh sửa"
                      >
                        <PencilIcon />
                      </Link>
                    )}
                    <button
                      type="button"
                      className="blog-icon-action blog-icon-danger"
                      aria-label={`Xóa bài ${blog.title}`}
                      title="Xóa"
                      onClick={() => {
                        setProblem("");
                        setNotice("");
                        setRemoving(blog);
                      }}
                      suppressHydrationWarning
                    >
                      <TrashIcon />
                    </button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      {data.totalPages > 1 && (
        <Pagination
          total={data.totalItems}
          page={data.page}
          size={data.pageSize}
          onChange={(next) => router.push(mineHref(status, next))}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          destructive
          loading={busy}
          title="Xóa bài viết này?"
          label="Xóa bài viết"
          cancelLabel="Giữ lại"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
          onConfirm={() => void confirmRemove()}
        >
          <div className="stack-sm">
            <p>
              <strong>{removing.title}</strong> sẽ bị xóa khỏi ANGI. Thao tác
              này không hoàn tác được.
            </p>
            {problem && <Alert>{problem}</Alert>}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
