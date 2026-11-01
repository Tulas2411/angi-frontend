"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button } from "@/shared/ui";
import { EmptyState, Tabs } from "@/components/ui/primitives";
import { getErrorMessage } from "@/shared/api/error";
import type { RoleCode } from "@/features/auth/types";
import { useRemote } from "@/features/explore/use-remote";
import {
  filterFromParam,
  fullNotificationTime,
  maxReadIds,
  notificationCategory,
  notificationDayGroup,
  notificationDayLabels,
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
import { NotificationGlyph } from "./notification-glyph";
import { notificationPageNumbers } from "./notification-page-numbers";
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
          ready.items.filter((item) => !item.readAt && read.has(item.id)).length,
      )
    : null;
  const heading = (
    <header className="notifications-heading">
      <div className="notifications-heading-text">
        <h1>Thông báo</h1>
        <p className="notifications-line">
          {unread === null
            ? "Tin mới về lộ trình, bài viết và nhà hàng của bạn"
            : unread === 0
              ? "Bạn đã đọc hết thông báo"
              : `${unread} thông báo chưa đọc`}
        </p>
      </div>
      <div className="notifications-heading-actions">
        <Button
          variant="secondary"
          disabled={!unread}
          loading={busy}
          onClick={() => void markRead("all")}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </div>
    </header>
  );
  const tabs = (
    <div className="notifications-toolbar">
      <Tabs
        label="Lọc thông báo"
        value={filter}
        onChange={(value) =>
          router.push(notificationsHref(value as NotificationFilter, 1))
        }
        items={notificationTabs}
      />
      {unread !== null && unread > 0 && (
        <span className="notifications-toolbar-count">
          <span className="notification-dot" aria-hidden />
          {unread} chưa đọc
        </span>
      )}
    </div>
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
  // The URL may ask for a page past the end; the last page that has rows wins.
  const currentPage = Math.min(Math.max(page, 1), Math.max(data.totalPages, 1));
  const pageNumbers = notificationPageNumbers(currentPage, data.totalPages);
  const range = {
    first: data.totalItems === 0 ? 0 : (currentPage - 1) * data.pageSize + 1,
    last: Math.min(currentPage * data.pageSize, data.totalItems),
  };
  // Rows are grouped by the day they arrived, so the list reads as a diary.
  const groups: { key: string; label: string; items: NotificationDto[] }[] = [];
  for (const notification of data.items) {
    const key = notificationDayGroup(notification.createdAt);
    const group = groups.find((item) => item.key === key);
    if (group) group.items.push(notification);
    else
      groups.push({
        key,
        label: notificationDayLabels[key],
        items: [notification],
      });
  }

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
        <div className="notifications-groups">
          {groups.map((group) => (
            <section className="notifications-group" key={group.key}>
              <h2 className="notifications-group-title">
                {group.label}
                <span className="notifications-group-count">
                  {group.items.length}
                </span>
              </h2>
              <ol className="notifications-list">
                {group.items.map((notification) => {
                  const isUnread =
                    !notification.readAt && !read.has(notification.id);
                  const category = notificationCategory(notification.type);
                  const href = notificationHref(notification, role);
                  return (
                    <li
                      key={notification.id}
                      className="notification-row"
                      data-unread={isUnread || undefined}
                    >
                      <NotificationGlyph
                        category={category.key}
                        className="notification-row-glyph"
                      />
                      <div className="notification-text">
                        <div className="notification-title-line">
                          <h3 id={`notification-${notification.id}`}>
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
                            {isUnread && (
                              <span className="sr-only"> (chưa đọc)</span>
                            )}
                          </h3>
                          <span className="notification-kind">
                            {category.label}
                          </span>
                        </div>
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
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                            <span>Đã đọc</span>
                          </button>
                        )}
                      </div>
                      {isUnread && (
                        <span className="notification-dot" aria-hidden />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
      {data.totalPages > 1 && (
        <nav className="notifications-pagination" aria-label="Phân trang thông báo">
          <div className="notifications-pagination-info">
            <span className="notifications-pagination-range">
              {range.first}–{range.last}
            </span>
            <span className="notifications-pagination-total">
              trên {data.totalItems} thông báo
            </span>
          </div>
          <div className="notifications-pagination-pages">
            <button
              type="button"
              className="notifications-pagination-step"
              disabled={currentPage <= 1 || busy}
              aria-label="Trang trước"
              onClick={() =>
                router.push(notificationsHref(filter, currentPage - 1))
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M14.5 6l-6 6 6 6" />
              </svg>
            </button>
            {pageNumbers.map((entry, index) =>
              entry === "gap" ? (
                <span
                  className="notifications-pagination-gap"
                  key={`gap-${index}`}
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={entry}
                  className="notifications-pagination-number"
                  aria-current={entry === page ? "page" : undefined}
                  aria-label={`Trang ${entry}`}
                  onClick={() => router.push(notificationsHref(filter, entry))}
                >
                  {entry}
                </button>
              ),
            )}
            <button
              type="button"
              className="notifications-pagination-step"
              disabled={currentPage >= data.totalPages || busy}
              aria-label="Trang sau"
              onClick={() =>
                router.push(notificationsHref(filter, currentPage + 1))
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9.5 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
