/** Wire DTOs of NOTI-01..03 (API Design v1.8, checked against MeNotificationController). */
import type { PagedDto } from "@/features/explore/explore-types";

export interface NotificationDto {
  id: number;
  /** VERIFICATION_APPROVED, MENU_REJECTED, BLOG_COMMENTED, REVIEW_REPLIED, ROADMAP_GENERATED… */
  type: string;
  title: string;
  body: string | null;
  /**
   * Where the notification points. The backend stores snake_case keys (`blog_id`,
   * `roadmap_id`); the API Design sample shows camelCase, so both are read.
   */
  data: Record<string, unknown>;
  /** `null` while unread. */
  readAt: string | null;
  createdAt: string;
}

/** NOTI-01: a page of notifications, newest first, with the unread total. */
export interface NotificationsResponseDto extends PagedDto<NotificationDto> {
  unreadCount: number;
}

export interface NotificationsQuery {
  isRead?: boolean;
  type?: string;
  page: number;
  pageSize: number;
}

/** NOTI-03: some notifications (`ids`, at most 100) or all of them. */
export interface MarkNotificationsReadRequestDto {
  ids?: number[];
  all?: boolean;
}

export interface MarkNotificationsReadResponseDto {
  updated: number;
}

export interface UnreadNotificationsDto {
  unreadCount: number;
}
