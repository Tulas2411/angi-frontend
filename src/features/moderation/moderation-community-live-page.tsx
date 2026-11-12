"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Pagination,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { FadingLines } from "@/components/ui/fading-text";
import { getErrorMessage } from "@/shared/api/error";
import { blogService } from "@/features/blogs/blog-service";
import type { BlogCommentDto } from "@/features/blogs/blog-types";
import { plainText } from "./report-handling-rules";
import "./community-moderation.css";
import {
  blogStatusLabels,
  commentStatusLabels,
  moderationBlogsService,
  type ModerationBlogsService,
} from "./moderation-blogs-service";
import type {
  ListModeratedBlogsQuery,
  ModeratedBlogDto,
  ModeratedBlogStatus,
  ModeratedCommentStatus,
} from "./moderation-users-types";
const PAGE_SIZE = 20;

/** Màu của badge trạng thái bài viết. */
function blogStatusTone(
  status: string,
): "neutral" | "success" | "error" | "warning" {
  if (status === "published") return "success";
  if (status === "removed") return "error";
  if (status === "hidden") return "warning";
  return "neutral";
}

/** Màu của badge trạng thái bình luận. */
function commentStatusTone(
  status: string,
): "neutral" | "success" | "error" | "warning" {
  if (status === "visible") return "success";
  if (status === "removed") return "error";
  if (status === "hidden") return "warning";
  return "neutral";
}

/** Dòng bảng: `DataTable` yêu cầu `id` là chuỗi, nên giữ thêm `blogId` gốc. */
type BlogRow = Omit<ModeratedBlogDto, "id"> & { id: string; blogId: number };

/**
 * MOD-B1..MOD-B3 — kiểm duyệt bài viết và bình luận cộng đồng.
 *
 * Màn hình đọc dữ liệu thật qua `/api/backend/mod/blogs`; access token của
 * kiểm duyệt viên không bao giờ tới trình duyệt.
 */
export function ModerationCommunityLivePage() {
  const service: ModerationBlogsService = moderationBlogsService;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    key: string;
    data: { items: ModeratedBlogDto[]; totalItems: number };
  } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    blog: ModeratedBlogDto;
    status: ModeratedBlogStatus;
    label: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [commentsOf, setCommentsOf] = useState<ModeratedBlogDto | null>(null);
  // Bình luận đã ẩn theo bài, giữ qua các lần đóng mở hộp thoại để còn hiển thị lại.
  const [hiddenComments, setHiddenComments] = useState<
    Record<number, BlogCommentDto[]>
  >({});

  /** Bộ lọc hiện tại là chìa khoá của lần tải; tải xong mới hiện dữ liệu. */
  const queryKey = `${query}|${status}|${reportedOnly}|${page}|${attempt}`;
  const loading = result?.key !== queryKey;
  const rows = result?.key === queryKey ? result.data.items : [];
  const totalItems = result?.key === queryKey ? result.data.totalItems : 0;

  useEffect(() => {
    let ignore = false;
    const listQuery: ListModeratedBlogsQuery = { page, pageSize: PAGE_SIZE };
    if (query.trim()) listQuery.q = query.trim();
    if (status !== "all") listQuery.status = status as ModeratedBlogStatus;
    if (reportedOnly) listQuery.reported = true;
    service
      .list(listQuery)
      .then((response) => {
        if (ignore) return;
        setResult({
          key: `${query}|${status}|${reportedOnly}|${page}|${attempt}`,
          data: { items: response.items, totalItems: response.totalItems },
        });
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
        // Không để màn hình kẹt ở trạng thái đang tải khi lần tải thất bại.
        setResult({
          key: `${query}|${status}|${reportedOnly}|${page}|${attempt}`,
          data: { items: [], totalItems: 0 },
        });
      });
    return () => {
      ignore = true;
    };
  }, [service, query, status, reportedOnly, page, attempt]);

  async function applyStatus() {
    if (!pending) return;
    if (!reason.trim()) {
      setFieldError("Vui lòng nhập lý do.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await service.setBlogStatus(pending.blog.id, {
        status: pending.status,
        reason: reason.trim(),
      });
      setSaved(`Đã cập nhật bài viết "${pending.blog.title}".`);
      setPending(null);
      setReason("");
      setAttempt((value) => value + 1);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeading
        title="Nội dung cộng đồng"
        description="Bài viết và bình luận có thao tác kiểm duyệt riêng. Không sửa lời người viết."
      />

      {error && <Alert tone="warning">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card title="Bộ lọc">
        <div className="grid-3">
          <Field
            placeholder="Nhập tiêu đề hoặc nội dung…"
            label="Tìm tiêu đề hoặc nội dung"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <SelectField
            label="Trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Mọi trạng thái" },
              { value: "published", label: "Đang hiển thị" },
              { value: "hidden", label: "Đang ẩn" },
              { value: "removed", label: "Đã gỡ" },
            ]}
          />
          <SelectField
            label="Báo cáo"
            value={reportedOnly ? "yes" : "no"}
            onChange={(value) => {
              setReportedOnly(value === "yes");
              setPage(1);
            }}
            options={[
              { value: "no", label: "Tất cả bài viết" },
              { value: "yes", label: "Chỉ bài viết có báo cáo" },
            ]}
          />
        </div>
      </Card>

      <Card title={`Bài viết · ${totalItems} bản ghi`}>
        {loading ? (
          <Skeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="Không có bài viết phù hợp">
            Thử đổi bộ lọc để xem thêm bài viết.
          </EmptyState>
        ) : (
          <DataTable
            rows={rows.map((blog): BlogRow => ({
              ...blog,
              id: String(blog.id),
              blogId: blog.id,
            }))}
            caption="Danh sách bài viết kiểm duyệt"
            columns={[
              {
                label: "Bài viết",
                render: (blog) => (
                  <div className="mc-blog-cell">
                    <FadingLines as="strong" text={blog.title} lines={2} />
                    <FadingLines
                      className="helper"
                      text={plainText(blog.excerpt)}
                      lines={2}
                    />
                  </div>
                ),
              },
              {
                label: "Tác giả",
                render: (blog) => blog.author.displayName,
              },
              {
                label: "Trạng thái",
                render: (blog) => (
                  <Badge tone={blogStatusTone(blog.status)}>
                    {blogStatusLabels[blog.status] ?? blog.status}
                  </Badge>
                ),
              },
              {
                label: "Báo cáo đang mở",
                render: (blog) => blog.pendingReportCount,
              },
              {
                label: "Thao tác",
                render: (blog) => (
                  <div className="actions">
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        const next =
                          blog.status === "published"
                            ? ("hidden" as ModeratedBlogStatus)
                            : ("published" as ModeratedBlogStatus);
                        setPending({
                          blog: {
                            ...blog,
                            id: blog.blogId,
                          },
                          status: next,
                          label:
                            next === "hidden"
                              ? "Ẩn bài viết"
                              : "Hiển thị lại bài viết",
                        });
                        setReason("");
                        setFieldError("");
                      }}
                    >
                      {blog.status === "published"
                        ? "Ẩn bài viết"
                        : "Hiển thị lại"}
                    </Button>
                    <Button
                      variant="tertiary"
                      onClick={() =>
                        setCommentsOf({ ...blog, id: blog.blogId })
                      }
                    >
                      Bình luận
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {totalItems > PAGE_SIZE && (
        <Pagination
          total={totalItems}
          page={page}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending?.label ?? "Cập nhật bài viết"}
        destructive={pending?.status === "hidden"}
        loading={busy}
        label="Xác nhận"
        onClose={() => setPending(null)}
        onConfirm={() => void applyStatus()}
      >
        <p>
          Bài viết: <strong>{pending?.blog.title}</strong>
        </p>
        <TextArea
          placeholder="Nêu lý do để tác giả hiểu…"
          label="Lý do"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (fieldError) setFieldError("");
          }}
          maxLength={1000}
          required
          error={fieldError}
        />
      </ConfirmDialog>

      <ModerationCommentsDialog
        key={commentsOf?.id ?? "comments"}
        blog={commentsOf}
        hidden={commentsOf ? (hiddenComments[commentsOf.id] ?? []) : []}
        onHiddenChange={(list) => {
          if (!commentsOf) return;
          const blogId = commentsOf.id;
          setHiddenComments((current) => ({ ...current, [blogId]: list }));
        }}
        onClose={() => setCommentsOf(null)}
        onChanged={() => setAttempt((value) => value + 1)}
      />
    </div>
  );
}

/**
 * MOD-B3 — ẩn bình luận và hiển thị lại bình luận vừa ẩn.
 *
 * Backend không có endpoint đọc bình luận cho kiểm duyệt viên, nên danh sách
 * lấy từ `GET blogs/{id}/comments` của phía công khai (chỉ trả bình luận đang
 * hiển thị). Bình luận Mod vừa ẩn được trang giữ lại (`hidden`) và vẫn hiện ở
 * chỗ cũ với nút "Hiển thị lại" (MOD-B3 status `visible`) cho tới khi tải lại
 * trang; sau đó backend không còn trả về nó nữa.
 */
function ModerationCommentsDialog({
  blog,
  hidden,
  onHiddenChange,
  onClose,
  onChanged,
}: {
  blog: ModeratedBlogDto | null;
  /** Bình luận của bài này đã ẩn trong lần mở trang hiện tại. */
  hidden: BlogCommentDto[];
  onHiddenChange: (hidden: BlogCommentDto[]) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const service: ModerationBlogsService = moderationBlogsService;
  const [comments, setComments] = useState<BlogCommentDto[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!blog) return;
    let ignore = false;
    blogService
      .comments(blog.id, 1, 50)
      .then((response) => {
        if (ignore) return;
        setComments(response.items);
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
      });
    return () => {
      ignore = true;
    };
  }, [blog]);

  async function setStatus(
    comment: BlogCommentDto,
    status: ModeratedCommentStatus,
  ) {
    setBusyId(comment.id);
    setError("");
    try {
      await service.setCommentStatus(comment.id, {
        status,
        reason:
          reason.trim() ||
          (status === "visible"
            ? "Hiển thị lại sau khi kiểm duyệt."
            : "Kiểm duyệt nội dung cộng đồng."),
      });
      onHiddenChange(
        status === "hidden"
          ? [...hidden.filter((item) => item.id !== comment.id), comment]
          : hidden.filter((item) => item.id !== comment.id),
      );
      onChanged();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  // Bình luận đang hiển thị (backend) cùng bình luận vừa ẩn, theo thứ tự thời gian.
  const hiddenIds = new Set(hidden.map((comment) => comment.id));
  const shown = comments
    ? [
        ...comments.filter((comment) => !hiddenIds.has(comment.id)),
        ...hidden,
      ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    : null;

  return (
    <Dialog
      open={!!blog}
      title={blog ? `Bình luận · ${blog.title}` : "Bình luận"}
      onClose={onClose}
    >
      {error && <Alert tone="warning">{error}</Alert>}
      <TextArea
        placeholder="Nêu lý do kiểm duyệt…"
        label="Lý do kiểm duyệt"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={1000}
        helper="Lý do dùng chung cho mọi bình luận bạn ẩn hoặc hiển thị lại trong phiên này."
      />
      {hidden.length > 0 && (
        <Alert tone="info">
          Bình luận đã ẩn vẫn hiện ở đây để bạn hiển thị lại nếu cần, cho tới
          khi tải lại trang.
        </Alert>
      )}
      {!shown ? (
        <Skeleton rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState title="Không có bình luận đang hiển thị">
          Bình luận đã ẩn từ trước không còn đọc được từ hệ thống.
        </EmptyState>
      ) : (
        <ul className="stack-sm">
          {shown.map((comment) => {
            const status = hiddenIds.has(comment.id) ? "hidden" : "visible";
            return (
              <li
                key={comment.id}
                className="stack-sm mc-comment"
                data-status={status}
              >
                <div className="between">
                  <strong>{comment.user.displayName}</strong>
                  <Badge tone={commentStatusTone(status)}>
                    {commentStatusLabels[status]}
                  </Badge>
                </div>
                <p className="helper">{comment.content}</p>
                <Button
                  variant="tertiary"
                  loading={busyId === comment.id}
                  onClick={() =>
                    void setStatus(
                      comment,
                      (status === "hidden"
                        ? "visible"
                        : "hidden") as ModeratedCommentStatus,
                    )
                  }
                >
                  {status === "hidden" ? "Hiển thị lại" : "Ẩn bình luận"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
