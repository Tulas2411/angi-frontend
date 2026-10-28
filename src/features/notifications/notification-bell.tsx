"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/primitives";
import { unreadBadge } from "./notification-rules";
import {
  notificationService,
  notificationsChangedEvent,
} from "./notification-service";
import "./notifications.css";

/**
 * NOTI-02 badge beside the account menu. It recounts on every navigation, when the tab regains
 * focus and when notifications were marked read; a failed count simply shows no number.
 */
export function NotificationBell() {
  const path = usePathname();
  const [count, setCount] = useState(0);
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
  const label =
    count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo, không có tin mới";
  return (
    <Link
      href="/notifications"
      className="notification-bell"
      aria-label={label}
      title={label}
      aria-current={path === "/notifications" ? "page" : undefined}
      prefetch={false}
    >
      <Icon name="bell" />
      {count > 0 && (
        <span className="notification-bell-count" aria-hidden>
          {unreadBadge(count)}
        </span>
      )}
    </Link>
  );
}
