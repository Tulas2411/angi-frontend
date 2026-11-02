/**
 * MOD-U1..MOD-U4 and MOD-B1..MOD-B3 wire contracts, API Design v1.8.
 *
 * Only the fields the moderator screens read are modelled. Every status value
 * is spelled exactly as the backend emits it (snake_case).
 */

/** Account status of a moderated user. */
export type ModeratedUserStatus =
  | "pending_verification"
  | "active"
  | "suspended"
  | "banned"
  | "deactivated";

/** The only two roles a moderated user can have. */
export type ModeratedUserRole = "TRAVELER" | "RESTAURANT_OWNER";

/** MOD-U3 sanction kinds. */
export type SanctionType = "warn" | "suspend" | "ban";

export interface ModeratedUserDto {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: ModeratedUserStatus;
  suspendedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SanctionDto {
  id: number;
  type: SanctionType;
  reason: string;
  reportId: number | null;
  issuedBy: { id: number; displayName: string; avatarUrl: string | null };
  startsAt: string;
  endsAt: string | null;
  liftedAt: string | null;
  liftedBy: { id: number; displayName: string; avatarUrl: string | null } | null;
  liftReason: string | null;
}

/** MOD-U2 — a user profile with its sanction history and content counters. */
export interface ModeratedUserDetailDto extends ModeratedUserDto {
  sanctions: SanctionDto[];
  blogCount: number;
  reviewCount: number;
  reportsAgainstContent: number;
  /** Present only when the user is a restaurant owner. */
  restaurant: {
    id: number;
    name: string;
    slug: string;
    coverUrl: string | null;
    addressLine: string;
    ratingAvg: number;
    ratingCount: number;
  } | null;
}

export interface ModeratedUsersPageDto {
  items: ModeratedUserDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** MOD-U1 filters. */
export interface ListModeratedUsersQuery {
  q?: string;
  role?: ModeratedUserRole;
  status?: ModeratedUserStatus;
  hasPendingReports?: boolean;
  page?: number;
  pageSize?: number;
}

/** MOD-U3 body. `endsAt` is required when `type` is `suspend`. */
export interface CreateSanctionRequestDto {
  type: SanctionType;
  reason: string;
  endsAt?: string;
  durationDays?: number;
  reportId?: number;
}

/** MOD-U4 body. */
export interface UnbanUserRequestDto {
  liftReason: string;
}

/** MOD-B1 — the moderation state of a blog. */
export type ModeratedBlogStatus = "published" | "hidden" | "removed";

/** MOD-B3 — the moderation state of a comment. */
export type ModeratedCommentStatus = "visible" | "hidden" | "removed";

export interface ModeratedBlogDto {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string | null;
  author: { id: number; displayName: string; avatarUrl: string | null };
  hasRoadmap: boolean;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  publishedAt: string;
  status: ModeratedBlogStatus;
  pendingReportCount: number;
}

export interface ModeratedBlogsPageDto {
  items: ModeratedBlogDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** MOD-B1 filters. */
export interface ListModeratedBlogsQuery {
  q?: string;
  status?: ModeratedBlogStatus;
  authorId?: number;
  reported?: boolean;
  page?: number;
  pageSize?: number;
}

/** MOD-B2 body. */
export interface UpdateBlogStatusRequestDto {
  status: ModeratedBlogStatus;
  reason: string;
}

/** MOD-B3 body. */
export interface UpdateCommentStatusRequestDto {
  status: ModeratedCommentStatus;
  reason: string;
}
