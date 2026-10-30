"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Input } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  EmptyState,
  Pagination,
  SelectField,
} from "@/components/ui/primitives";
import { ReportDialog } from "@/components/domain/report-dialog";
import { useRemote } from "@/features/explore/use-remote";
import { BlogCard } from "./blog-cards";
import { BlogHeading, BlogProblem, BlogSkeleton } from "./blog-layout";
import {
  blogDate,
  blogFiltersFromParams,
  blogFiltersHref,
  blogPageSize,
  blogReportError,
  blogReportReasons,
  blogSortOptions,
  type BlogFilters,
} from "./blog-rules";
import { blogService, type BlogService } from "./blog-service";
import type { BlogSort } from "./blog-types";
import "./blogs.css";

function Toolbar({
  initial,
  onApply,
}: {
  initial: BlogFilters;
  onApply: (filters: BlogFilters) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const hasFilter = Boolean(initial.q || initial.hasRoadmap);
  return (
    <form
      className="blog-toolbar"
      role="search"
      aria-label="Tìm cẩm nang"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ ...draft, page: 1 });
      }}
    >
      <div className="field blog-toolbar-search">
        <label htmlFor="blog-search">Tìm cẩm nang</label>
        <Input
          id="blog-search"
          type="search"
          value={draft.q}
          placeholder="Đà Nẵng, bún chả, cà phê…"
          autoComplete="off"
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
        />
      </div>
      <SelectField
        label="Sắp xếp"
        value={draft.sort}
        options={blogSortOptions}
        onChange={(value) =>
          setDraft({ ...draft, sort: value as BlogSort, page: 1 })
        }
      />
      <div className="blog-toolbar-check">
        <Choice
          label="Chỉ bài có lịch ăn đính kèm"
          checked={draft.hasRoadmap}
          onChange={(checked) => setDraft({ ...draft, hasRoadmap: checked })}
        />
      </div>
      <div className="blog-toolbar-actions">
        <Button type="submit">Tìm cẩm nang</Button>
        {hasFilter && (
          <Button
            variant="tertiary"
            onClick={() =>
              onApply({ q: "", sort: initial.sort, hasRoadmap: false, page: 1 })
            }
          >
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </form>
  );
}

/** F-31 View Public Blog: BLOG-01 with the filters and the page in the URL. */
export function BlogListPage({
  signedIn,
  viewerId = null,
  service = blogService,
}: {
  /** A Traveler can write; a guest is asked to sign in. */
  signedIn: boolean;
  /** The id of the signed-in Traveler, so their own blogs are not offered for a report. */
  viewerId?: number | null;
  service?: BlogService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.toString();
  const filters = useMemo(() => blogFiltersFromParams(params), [params]);
  const [state, retry] = useRemote(
    () =>
      service.list({
        q: filters.q.trim() || undefined,
        hasRoadmap: filters.hasRoadmap || undefined,
        sort: filters.sort,
        page: filters.page,
        pageSize: blogPageSize,
      }),
    key,
  );
  // The blog whose report is open, and the outcome of the last report.
  const [reportBlogId, setReportBlogId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  // A bookmarked page past the end falls back to the last page.
  const lastPage =
    state.status === "ready" &&
    !state.data.items.length &&
    state.data.totalPages > 0 &&
    filters.page > state.data.totalPages
      ? state.data.totalPages
      : null;
  useEffect(() => {
    if (lastPage)
      router.replace(blogFiltersHref({ ...filters, page: lastPage }));
  }, [lastPage, router, filters]);

  const ready = state.status === "ready" ? state.data : null;
  const newest =
    ready && filters.sort === "newest" && filters.page === 1
      ? ready.items[0]
      : null;
  const heading = (
    <BlogHeading
      title="Cẩm nang ẩm thực"
      line={
        ready
          ? `${ready.totalItems} bài${
              newest ? `, mới nhất ngày ${blogDate(newest.publishedAt)}` : ""
            }`
          : "Mọi người đã ăn gì trong chuyến đi của mình"
      }
      actions={
        signedIn ? (
          <>
            <ActionLink href="/guides/mine" secondary>
              Bài viết của tôi
            </ActionLink>
            <ActionLink href="/guides/new">Viết cẩm nang</ActionLink>
          </>
        ) : (
          <ActionLink href="/login">Đăng nhập để viết cẩm nang</ActionLink>
        )
      }
    />
  );
  const toolbar = (
    <Toolbar
      key={key}
      initial={filters}
      onApply={(next) => router.push(blogFiltersHref(next))}
    />
  );

  if (state.status === "loading" || lastPage)
    return (
      <div className="blog-page">
        {heading}
        {toolbar}
        <BlogSkeleton lead rows={4} />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="blog-page">
        {heading}
        {toolbar}
        <BlogProblem
          title="Chưa tải được cẩm nang"
          error={state.error}
          onRetry={retry}
        />
      </div>
    );
  const { data } = state;
  const reported = data.items.find((blog) => blog.id === reportBlogId) ?? null;
  return (
    <div className="blog-page">
      {heading}
      {toolbar}
      {notice && <Alert tone="success">{notice}</Alert>}
      {data.items.length === 0 ? (
        <EmptyState title="Chưa có cẩm nang phù hợp">
          Thử từ khóa khác, hoặc là người đầu tiên viết một bài.
        </EmptyState>
      ) : (
        <ul className="blog-cards">
          {data.items.map((blog) => {
            const mine = viewerId !== null && blog.author.id === viewerId;
            return (
              <li key={blog.id}>
                <BlogCard
                  blog={blog}
                  menu={
                    <>
                      {signedIn && !mine && (
                        <button
                          type="button"
                          role="menuitem"
                          className="blog-menu-item"
                          onClick={() => {
                            setNotice("");
                            setReportBlogId(blog.id);
                          }}
                          suppressHydrationWarning
                        >
                          Báo cáo bài viết
                        </button>
                      )}
                      {(!signedIn || mine) && (
                        <p className="blog-menu-note">
                          {signedIn
                            ? "Đây là bài viết của bạn."
                            : "Đăng nhập để báo cáo bài viết này."}
                        </p>
                      )}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {data.totalPages > 1 && (
        <Pagination
          total={data.totalItems}
          page={data.page}
          size={data.pageSize}
          onChange={(next) =>
            router.push(blogFiltersHref({ ...filters, page: next }))
          }
        />
      )}
      {reported && (
        <ReportDialog
          open
          title="Báo cáo bài viết"
          reasons={blogReportReasons}
          send={(request) => service.report(reported.id, request)}
          upload={(file) => service.upload(file, "report_evidence")}
          errorOf={blogReportError}
          onClose={() => setReportBlogId(null)}
          onSent={(already) => {
            setReportBlogId(null);
            setNotice(
              already
                ? "Báo cáo trước đó của bạn về bài viết này đang chờ xử lý."
                : "Đã gửi báo cáo. Đội kiểm duyệt sẽ xem xét sớm.",
            );
          }}
        />
      )}
    </div>
  );
}
