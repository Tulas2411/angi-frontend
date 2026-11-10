"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BellIcon } from "@heroicons/react/24/outline";
import type { RoleCode } from "@/features/auth/types";
import {
  notificationCategory,
  notificationHref,
  notificationPreviewSize,
  notificationTime,
  unreadBadge,
} from "./notification-rules";
import {
  announceNotificationsChanged,
  notificationService,
  notificationsChangedEvent,
} from "./notification-service";
import { NotificationGlyph } from "./notification-glyph";
import type { NotificationDto } from "./notification-types";
import "./notifications.css";

/**
 * NOTI-02: the bell shows how many notifications are unread. Clicking it opens a dropdown
 * with the latest news and a "Xem tất cả" link that leads to the full list.
 */
export function NotificationBell({
  role,
  variant = "header",
}: {
  role: RoleCode;
  /**
   * "header": the round bell of the site header. "sidebar": a row of the dashboard sidebar
   * (icon, label, count) whose panel opens beside the sidebar, above every page.
   */
  variant?: "header" | "sidebar";
}) {
  const path = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // The dropdown closes itself after a navigation; remembering the path it was opened
  // on is cheaper than an effect that would set state after every route change.
  const [openedAt, setOpenedAt] = useState(path);
  const isOpen = open && openedAt === path;

  useEffect(() => {
    let ignore = false;
    const load = () =>
      notificationService
        .unreadCount()
        .then((result) => {
          if (!ignore) setCount(Math.max(0, result.unreadCount));
        })
        .catch(() => {
          if (!ignore) setCount(0);
        });
    void load();
    window.addEventListener(notificationsChangedEvent, load);
    window.addEventListener("focus", load);
    return () => {
      ignore = true;
      window.removeEventListener(notificationsChangedEvent, load);
      window.removeEventListener("focus", load);
    };
  }, [path]);

  // The dropdown is only fetched when it is first opened, then kept fresh by the event.
  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    const load = () => {
      setLoading(true);
      return notificationService
        .list({ page: 1, pageSize: notificationPreviewSize })
        .then((result) => {
          if (!ignore) setItems(result.items);
        })
        .catch(() => {
          if (!ignore) setItems([]);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    };
    void load();
    const onChanged = () => void load();
    window.addEventListener(notificationsChangedEvent, onChanged);
    return () => {
      ignore = true;
      window.removeEventListener(notificationsChangedEvent, onChanged);
    };
  }, [isOpen]);

  // Close on outside click, on Escape (focus returns to the bell) and after navigating.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panel.current?.contains(target) &&
        !trigger.current?.contains(target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const label =
    count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo, không có tin mới";

  function toggle() {
    const next = !isOpen;
    setOpen(next);
    if (next) setOpenedAt(path);
  }

  async function openNotification(notification: NotificationDto) {
    setOpen(false);
    // Mark it read before navigating, so the request is not cancelled by the route change.
    if (!notification.readAt)
      await notificationService
        .markRead({ ids: [notification.id] })
        .then(() => announceNotificationsChanged())
        .catch(() => undefined);
    const href = notificationHref(notification, role);
    if (href) router.push(href);
  }

  const sidebar = variant === "sidebar";
  // The sidebar scrolls and turns into a sliding drawer on a phone, so its panel lives on
  // <body>; the header panel stays next to the bell.
  const place = (node: ReactNode) =>
    sidebar && typeof document !== "undefined"
      ? createPortal(node, document.body)
      : node;

  return (
    <div className="notification-bell-wrap" data-variant={variant}>
      <button
        ref={trigger}
        type="button"
        className={sidebar ? "admin-sidebar-bell" : "notification-bell"}
        aria-label={label}
        title={sidebar ? undefined : label}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-current={path === "/notifications" ? "page" : undefined}
        onClick={toggle}
      >
        <BellIcon aria-hidden />
        {sidebar && <span aria-hidden>Thông báo</span>}
        {count > 0 && (
          <span
            className={
              sidebar ? "admin-sidebar-badge" : "notification-bell-count"
            }
            aria-hidden
          >
            {unreadBadge(count)}
          </span>
        )}
      </button>
      {isOpen && place(
        <div
          ref={panel}
          className={`notification-dropdown${sidebar ? " notification-dropdown-sidebar" : ""}`}
          role="dialog"
          aria-label="Thông báo mới nhất"
        >
          <div className="notification-dropdown-head">
            <strong>Thông báo</strong>
            {count > 0 ? (
              <span className="notification-dropdown-count">
                {unreadBadge(count)} chưa đọc
              </span>
            ) : (
              <span className="notification-dropdown-count">
                Bạn đã đọc hết
              </span>
            )}
          </div>
          <div className="notification-dropdown-body">
            {loading && items === null ? (
              <div className="notification-dropdown-skeleton" aria-hidden />
            ) : !items || items.length === 0 ? (
              <p className="notification-dropdown-empty">
                Chưa có thông báo nào. ANGI sẽ báo cho bạn khi có tin mới.
              </p>
            ) : (
              <ul className="notification-dropdown-list">
                {items.map((notification) => {
                  const category = notificationCategory(notification.type);
                  const href = notificationHref(notification, role);
                  const unread = !notification.readAt;
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        className="notification-dropdown-item"
                        data-unread={unread || undefined}
                        onClick={() => void openNotification(notification)}
                      >
                        <NotificationGlyph
                          category={category.key}
                          className="notification-dropdown-glyph"
                        />
                        <span className="notification-dropdown-text">
                          <span className="notification-dropdown-title">
                            {notification.title}
                          </span>
                          {notification.body && (
                            <span className="notification-dropdown-body-text">
                              {notification.body}
                            </span>
                          )}
                          <span className="notification-dropdown-meta">
                            {category.label} ·{" "}
                            {notificationTime(notification.createdAt)}
                            {href ? "" : " · Xem trong danh sách"}
                          </span>
                        </span>
                        {unread && (
                          <span className="notification-dot" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="notification-dropdown-foot">
            <Link
              href="/notifications"
              className="notification-dropdown-all"
              onClick={() => setOpen(false)}
            >
              Xem tất cả thông báo
            </Link>
          </div>
        </div>,
      )}
    </div>
  );
}
