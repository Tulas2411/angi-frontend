import { api } from "@/shared/api/client";
import { queryString } from "@/features/explore/explore-service";
import type {
  PagedDto,
  UploadedMediaDto,
} from "@/features/explore/explore-types";
import type {
  BlogCardDto,
  BlogCommentDto,
  BlogDetailDto,
  BlogLikeDto,
  CreateBlogRequestDto,
  EditBlogRequestDto,
  MyBlogCardDto,
  MyBlogsQuery,
  PublicBlogsQuery,
  ReportBlogRequestDto,
  ReportBlogResponseDto,
} from "./blog-types";

/**
 * Reading public blogs never sends a guest to the login page (`getOptional`); everything that
 * writes or reads "my" data needs a Traveler session.
 */
export interface BlogService {
  list(query: PublicBlogsQuery): Promise<PagedDto<BlogCardDto>>;
  mine(query: MyBlogsQuery): Promise<PagedDto<MyBlogCardDto>>;
  detail(blogId: number): Promise<BlogDetailDto>;
  comments(
    blogId: number,
    page: number,
    pageSize: number,
  ): Promise<PagedDto<BlogCommentDto>>;
  create(request: CreateBlogRequestDto): Promise<BlogDetailDto>;
  edit(blogId: number, request: EditBlogRequestDto): Promise<BlogDetailDto>;
  remove(blogId: number): Promise<null>;
  like(blogId: number): Promise<BlogLikeDto>;
  unlike(blogId: number): Promise<BlogLikeDto>;
  comment(blogId: number, content: string): Promise<BlogCommentDto>;
  removeComment(blogId: number, commentId: number): Promise<null>;
  report(
    blogId: number,
    request: ReportBlogRequestDto,
  ): Promise<ReportBlogResponseDto>;
  upload(
    file: File,
    purpose: "blog" | "report_evidence",
  ): Promise<UploadedMediaDto>;
}

export const blogService: BlogService = {
  list: (query) => api.getOptional(`blogs${queryString(query)}`),
  mine: (query) => api.get(`me/blogs${queryString(query)}`),
  detail: (blogId) => api.getOptional(`blogs/${blogId}`),
  comments: (blogId, page, pageSize) =>
    api.getOptional(
      `blogs/${blogId}/comments${queryString({ page, pageSize })}`,
    ),
  create: (request) => api.post("blogs", request),
  edit: (blogId, request) => api.patch(`blogs/${blogId}`, request),
  remove: (blogId) => api.delete(`blogs/${blogId}`),
  like: (blogId) => api.put(`blogs/${blogId}/like`, undefined),
  unlike: (blogId) => api.delete(`blogs/${blogId}/like`),
  comment: (blogId, content) =>
    api.post(`blogs/${blogId}/comments`, { content }),
  removeComment: (blogId, commentId) =>
    api.delete(`blogs/${blogId}/comments/${commentId}`),
  report: (blogId, request) => api.post(`blogs/${blogId}/reports`, request),
  upload: (file, purpose) => {
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", purpose);
    return api.upload("media", body);
  },
};
