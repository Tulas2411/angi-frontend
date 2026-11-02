import { api } from "@/shared/api/client";
import type {
  ListModeratedBlogsQuery,
  ModeratedBlogsPageDto,
  UpdateBlogStatusRequestDto,
  UpdateCommentStatusRequestDto,
} from "./moderation-users-types";

/**
 * MOD-B1..MOD-B3 — community content moderation.
 *
 * The endpoints live behind the same-origin proxy (`/api/backend/mod/blogs`),
 * so the moderator's access token never reaches the browser.
 */
export interface ModerationBlogsService {
  /** MOD-B1: one page of the blogs pending moderation. */
  list(query: ListModeratedBlogsQuery): Promise<ModeratedBlogsPageDto>;
  /** MOD-B2: hides, removes or restores a blog. */
  setBlogStatus(
    blogId: number,
    request: UpdateBlogStatusRequestDto,
  ): Promise<{ blogId: number; status: string }>;
  /** MOD-B3: hides, removes or restores one comment. */
  setCommentStatus(
    commentId: number,
    request: UpdateCommentStatusRequestDto,
  ): Promise<{ commentId: number; status: string }>;
}

const base = "mod/blogs";

export const moderationBlogsService: ModerationBlogsService = {
  list: (query) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.authorId !== undefined)
      params.set("authorId", String(query.authorId));
    if (query.reported !== undefined)
      params.set("reported", String(query.reported));
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.pageSize !== undefined)
      params.set("pageSize", String(query.pageSize));
    const search = params.toString();
    return api.get<ModeratedBlogsPageDto>(`${base}${search ? `?${search}` : ""}`);
  },
  setBlogStatus: (blogId, request) =>
    api.put<{ blogId: number; status: string }>(
      `${base}/${blogId}/status`,
      request,
    ),
  setCommentStatus: (commentId, request) =>
    api.put<{ commentId: number; status: string }>(
      `mod/blog-comments/${commentId}/status`,
      request,
    ),
};

/** Nhãn tiếng Việt của trạng thái bài viết. */
export const blogStatusLabels: Record<string, string> = {
  published: "Đang hiển thị",
  hidden: "Đang ẩn",
  removed: "Đã gỡ",
};

/** Nhãn tiếng Việt của trạng thái bình luận. */
export const commentStatusLabels: Record<string, string> = {
  visible: "Đang hiển thị",
  hidden: "Đang ẩn",
  removed: "Đã gỡ",
};
