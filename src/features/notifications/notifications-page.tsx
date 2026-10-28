"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button } from "@/shared/ui";
import { EmptyState, Pagination, Tabs } from "@/components/ui/primitives";
import { getErrorMessage } from "@/shared/api/error";
import type { RoleCode } from "@/features/auth/types";
import { useRemote } from "@/features/explore/use-remote";
import {
  filterFromParam,
  fullNotificationTime,
  maxReadIds,
  notificationHref,
  notificationPageSize,
  notificationsHref,
  notificationTabs,
  notificationTime,
  type NotificationFilter,
} from "./notification-rules";
import {
  announceNotificationsChanged,
  notificationService,
  type NotificationService,
} from "./notification-service";
import type { NotificationDto } from "./notification-types";
import "./notifications.css";

/**
 * F-09 View Notifications (NOTI-01, with an unread tab) and F-10 Mark Notification as Read
 * (NOTI-03, per row, on opening a row, and for everything).
 */
export function NotificationsPage({
  role,
  service = notificationService,
}: {
  role: RoleCode;
  service?: NotificationService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const filter = filterFromParam(params.get("filter"));
  const pageParam = Number(params.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () =>
      service.list({
        isRead: filter === "unread" ? false : undefined,
        page,
        pageSize: notificationPageSize,
      }),
    `${filter}:${page}:${version}`,
  );
  // Rows read on this screen since the last load; the list is not reloaded for each one.
  const [read, setRead] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const marking = useRef(false);

  async function markRead(ids: number[] | "all") {
    if (marking.current) return false;
    marking.current = true;
    setBusy(true);
    setProblem("");
    setNotice("");
    try {
      const result = await service.markRead(
        ids === "all" ? { all: true } : { ids: ids.slice(0, maxReadIds) },
      );
      announceNotificationsChanged();
      if (ids === "all") {
        setNotice(
          result.updated > 0
            ? `Đã đánh dấu ${result.updated} thông báo là đã đọc.`
            : "Không còn thông báo chưa đọc.",
        );
        setRead(new Set());
        setVersion((value) => value + 1);
      } else setRead((previous) => new Set([...previous, ...ids]));
      return true;
    } catch (caught) {
      setProblem(getErrorMessage(caught));
      return false;
    } finally {
      marking.current = false;
      setBusy(false);
    }
  }

  async function open(notification: NotificationDto, href: string) {
    if (!notification.readAt && !read.has(notification.id))
      await markRead([notification.id]);
    router.push(href);
  }

  const ready = state.status === "ready" ? state.data : null;
  const unread = ready
    ? Math.max(
        0,
        ready.unreadCount -
          ready.items.filter((item) => !item.readAt && read.has(item.id))
            .length,
      )
    : null;
  const heading = (
    <header className="notifications-heading">
      <div>
        <h1>Thông báo</h1>
        <p className="notifications-line">
          {unread === null
            ? "Tin mới về lộ trình, bài viết và nhà hàng của bạn"
            : unread === 0
              ? "Bạn đã đọc hết thông báo"
              : `${unread} thông báo chưa đọc`}
        </p>
      </div>
      <Button
        variant="secondary"
        disabled={!unread}
        loading={busy}
        onClick={() => void markRead("all")}
      >
        Đánh dấu tất cả đã đọc
      </Button>
    </header>
  );
  const tabs = (
    <Tabs
      label="Lọc thông báo"
      value={filter}
      onChange={(value) =>
        router.push(notificationsHref(value as NotificationFilter, 1))
      }
      items={notificationTabs}
    />
  );

  if (state.status === "loading")
    return (
      <div className="notifications-page">
        {heading}
        {tabs}
        <div role="status" aria-label="Đang tải" className="notifications-list">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="notifications-skeleton" key={index} />
          ))}
          <span className="sr-only">Đang tải thông báo…</span>
        </div>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="notifications-page">
        {heading}
        {tabs}
        <section className="notifications-problem stack-sm">
          <h2>Chưa tải được thông báo</h2>
          <Alert>{getErrorMessage(state.error)}</Alert>
          <div>
            <Button variant="secondary" onClick={retry}>
              Thử lại
            </Button>
          </div>
        </section>
      </div>
    );

  const { data } = state;
  return (
    <div className="notifications-page">
      {heading}
      {tabs}
      {notice && <Alert tone="success">{notice}</Alert>}
      {problem && <Alert>{problem}</Alert>}
      {data.items.length === 0 ? (
        <EmptyState
          title={
            filter === "unread"
              ? "Không có thông báo chưa đọc"
              : "Chưa có thông báo nào"
          }
          action={
            filter === "unread" ? (
              <Link className="button button-secondary" href="/notifications">
                Xem tất cả thông báo
              </Link>
            ) : undefined
          }
        >
          {filter === "unread"
            ? "Bạn đã xem hết tin mới."
            : "ANGI sẽ báo cho bạn khi có bình luận, phản hồi hoặc kết quả kiểm duyệt."}
        </EmptyState>
      ) : (
        <ol className="notifications-list">
          {data.items.map((notification) => {
            const isUnread = !notification.readAt && !read.has(notification.id);
            const href = notificationHref(notification, role);
            return (
              <li
                key={notification.id}
                className="notification-row"
                data-unread={isUnread || undefined}
              >
                <span className="notification-dot" aria-hidden />
                <div className="notification-text">
                  <h2 id={`notification-${notification.id}`}>
                    {href ? (
                      <a
                        href={href}
                        onClick={(event) => {
                          if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.button !== 0
                          )
                            return;
                          event.preventDefault();
                          void open(notification, href);
                        }}
                      >
                        {notification.title}
                      </a>
                    ) : (
                      notification.title
                    )}
                    {isUnread && <span className="sr-only"> (chưa đọc)</span>}
                  </h2>
                  {notification.body && <p>{notification.body}</p>}
                </div>
                <div className="notification-side">
                  <time
                    dateTime={notification.createdAt}
                    title={fullNotificationTime(notification.createdAt)}
                  >
                    {notificationTime(notification.createdAt)}
                  </time>
                  {isUnread && (
                    <button
                      type="button"
                      className="notification-read"
                      disabled={busy}
                      aria-label={`Đánh dấu đã đọc: ${notification.title}`}
                      onClick={() => void markRead([notification.id])}
                    >
                      Đã đọc
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {data.totalPages > 1 && (
        <Pagination
          total={data.totalItems}
          page={data.page}
          size={data.pageSize}
          onChange={(next) => router.push(notificationsHref(filter, next))}
        />
      )}
    </div>
  );
}
