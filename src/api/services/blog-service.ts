import { api } from "@/shared/api/client";
import type {
  BlogCardDto,
  BlogDetailDto,
  CommentDto,
  CreateBlogCommentRequestDto,
  CreateBlogRequestDto,
  CreateReportResponseDto,
  EditBlogRequestDto,
  MyBlogCardDto,
  PagedDto,
  ReportBlogRequestDto,
} from "@/shared/types/angi-dto";

/** Query của BLOG-01. */
export interface BlogListQuery {
  /** Từ khoá tìm trong tiêu đề và nội dung. */
  q?: string;
  authorId?: number;
  hasRoadmap?: boolean;
  /** `new` | `popular` — BE bỏ trống thì dùng thứ tự mặc định. */
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** Query của BLOG-05. */
export interface MyBlogQuery {
  /** `published` | `hidden` | `removed`. */
  status?: string;
  page?: number;
  pageSize?: number;
}

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface BlogService {
  /** BLOG-01 — 200 OK, một trang blog công khai. */
  list(query?: BlogListQuery): Promise<PagedDto<BlogCardDto>>;
  /** BLOG-02 — 200 OK, chi tiết bài viết. */
  detail(blogId: number): Promise<BlogDetailDto>;
  /** BLOG-03 — 200 OK, trang bình luận đang hiển thị. */
  comments(
    blogId: number,
    page?: number,
    pageSize?: number,
  ): Promise<PagedDto<CommentDto>>;
  /** BLOG-05 — 200 OK, bài viết của chính người đang đăng nhập. */
  myBlogs(query?: MyBlogQuery): Promise<PagedDto<MyBlogCardDto>>;
  /** BLOG-04 — 201 Created, bài viết vừa đăng. */
  create(request: CreateBlogRequestDto): Promise<BlogDetailDto>;
  /** BLOG-06 — 200 OK, bài viết vừa sửa. */
  edit(blogId: number, request: EditBlogRequestDto): Promise<BlogDetailDto>;
  /** BLOG-07 — 200 OK với `data: null`, bài viết đã bị xoá mềm. */
  remove(blogId: number): Promise<null>;
  /** BLOG-10 — 201 Created, bình luận vừa gửi. */
  createComment(
    blogId: number,
    request: CreateBlogCommentRequestDto,
  ): Promise<CommentDto>;
  /** BLOG-11 — 200 OK với `data: null`, bình luận đã bị xoá mềm. */
  removeComment(blogId: number, commentId: number): Promise<null>;
  /** REP-02 — 201 Created, mã và trạng thái báo cáo. */
  report(
    blogId: number,
    request: ReportBlogRequestDto,
  ): Promise<CreateReportResponseDto>;
}

export const blogService: BlogService = {
  list: (query) =>
    api.get<PagedDto<BlogCardDto>>(
      `blogs${queryString({
        q: query?.q,
        authorId: query?.authorId,
        hasRoadmap: query?.hasRoadmap,
        sort: query?.sort,
        page: query?.page,
        pageSize: query?.pageSize,
      })}`,
    ),
  detail: (blogId) => api.get<BlogDetailDto>(`blogs/${blogId}`),
  comments: (blogId, page = 1, pageSize = 20) =>
    api.get<PagedDto<CommentDto>>(
      `blogs/${blogId}/comments?page=${page}&pageSize=${pageSize}`,
    ),
  myBlogs: (query) =>
    api.get<PagedDto<MyBlogCardDto>>(
      `me/blogs${queryString({
        status: query?.status,
        page: query?.page,
        pageSize: query?.pageSize,
      })}`,
    ),
  create: (request) => api.post<BlogDetailDto>("blogs", request),
  edit: (blogId, request) =>
    api.patch<BlogDetailDto>(`blogs/${blogId}`, request),
  remove: (blogId) => api.delete<null>(`blogs/${blogId}`),
  createComment: (blogId, request) =>
    api.post<CommentDto>(`blogs/${blogId}/comments`, request),
  removeComment: (blogId, commentId) =>
    api.delete<null>(`blogs/${blogId}/comments/${commentId}`),
  report: (blogId, request) =>
    api.post<CreateReportResponseDto>(`blogs/${blogId}/reports`, request),
};
