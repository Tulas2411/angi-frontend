import { api } from "@/shared/api/client";
import { queryString } from "@/features/explore/explore-service";
import type {
  MarkNotificationsReadRequestDto,
  MarkNotificationsReadResponseDto,
  NotificationsQuery,
  NotificationsResponseDto,
  UnreadNotificationsDto,
} from "./notification-types";

/**
 * NOTI-01..03 for every signed-in role. The header badge uses `getOptional`, so an expired session
 * on a public page never sends the visitor to the login page just to count notifications.
 */
export interface NotificationService {
  list(query: NotificationsQuery): Promise<NotificationsResponseDto>;
  unreadCount(): Promise<UnreadNotificationsDto>;
  markRead(
    request: MarkNotificationsReadRequestDto,
  ): Promise<MarkNotificationsReadResponseDto>;
}

export const notificationService: NotificationService = {
  list: (query) => api.get(`me/notifications${queryString(query)}`),
  unreadCount: () => api.getOptional("me/notifications/unread-count"),
  markRead: (request) => api.post("me/notifications/read", request),
};

/** Fired after notifications were marked read, so the header badge recounts at once. */
export const notificationsChangedEvent = "angi:notifications-changed";

export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(notificationsChangedEvent));
}
