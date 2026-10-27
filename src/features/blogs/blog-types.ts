/** Wire DTOs of the blog operations (API Design v1.8: BLOG-01..11, REP-02). */
import type {
  PagedDto,
  UserSummaryDto,
} from "@/features/explore/explore-types";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type BlogStatus = "published" | "hidden" | "removed";
export type BlogSort = "newest" | "popular";

export interface BlogCardDto {
  id: number;
  title: string;
  slug: string;
  /** First 200 characters of the content, plain text. */
  excerpt: string;
  coverUrl: string | null;
  author: UserSummaryDto;
  hasRoadmap: boolean;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  publishedAt: string;
}

export interface MyBlogCardDto extends BlogCardDto {
  status: BlogStatus;
  moderationNote: string | null;
}

export interface RoadmapSnapshotItemDto {
  mealSlot: MealSlot;
  dishId: number;
  dishName: string;
  price: number;
  restaurantId: number;
  restaurantName: string;
  address: string;
}

export interface RoadmapSnapshotDto {
  roadmapId: number;
  title: string;
  startDate: string | null;
  numDays: number;
  totalCost: number;
  capturedAt: string;
  days: { dayNumber: number; items: RoadmapSnapshotItemDto[] }[];
}

export interface BlogDetailDto extends BlogCardDto {
  /** Sanitized HTML (the backend sanitizes before saving). */
  content: string;
  images: string[];
  /** Null once the shared roadmap was deleted. */
  roadmapId: number | null;
  roadmapSnapshot: RoadmapSnapshotDto | null;
  likedByMe: boolean;
  isMine: boolean;
  updatedAt: string;
}

export interface BlogCommentDto {
  id: number;
  blogId: number;
  user: UserSummaryDto;
  content: string;
  createdAt: string;
  isMine: boolean;
}

export interface BlogLikeDto {
  liked: boolean;
  likeCount: number;
}

export interface PublicBlogsQuery {
  q?: string;
  hasRoadmap?: boolean;
  sort?: BlogSort;
  page?: number;
  pageSize?: number;
}

export interface MyBlogsQuery {
  status?: BlogStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateBlogRequestDto {
  title: string;
  content: string;
  coverMediaId?: number;
  imageMediaIds?: number[];
  roadmapId?: number;
}

/** BLOG-06: only the fields that are sent change; `coverMediaId: null` removes the cover. */
export interface EditBlogRequestDto {
  title?: string;
  content?: string;
  coverMediaId?: number | null;
  imageMediaIds?: number[];
  refreshRoadmapSnapshot?: boolean;
}

export type BlogReportReason =
  "spam" | "offensive" | "wrong_info" | "scam" | "other";

export interface ReportBlogRequestDto {
  reasonCode: BlogReportReason;
  description?: string;
  evidenceMediaIds?: number[];
}

export interface ReportBlogResponseDto {
  reportId: number;
  status: "pending";
}

export type { PagedDto };
