"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/primitives";
import { LogoutButton } from "@/features/auth/logout-button";
import { LABEL_BY_ROLE } from "@/features/auth/roles";
import { NotificationBell } from "@/features/notifications/notification-bell";
import type { AuthUserDto } from "@/features/auth/types";
import { roadmapRoutes } from "@/features/roadmaps/routes";

/** Signed-in menu (with the notification bell) shared by the homepage and every protected page. */
export function AccountMenu({ user }: { user: AuthUserDto }) {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  // Mouse hover opens the menu; leaving closes it after a short grace period
  // so the pointer can cross the gap between the avatar and the panel.
  const hoverOpened = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Close after navigation.
  useEffect(() => {
    menu.current?.removeAttribute("open");
  }, [path]);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  // Close on outside click, Escape, blur and resize; Escape returns focus to the trigger.
  useEffect(() => {
    const element = menu.current;
    if (!element) return;
    const close = () => element.removeAttribute("open");
    const onPointerDown = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !element.hasAttribute("open")) return;
      close();
      element.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, []);
  return (
    <>
      <NotificationBell />
      <details
        className="account-menu"
        ref={menu}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          clearTimeout(leaveTimer.current);
          if (!menu.current?.open) hoverOpened.current = true;
          menu.current?.setAttribute("open", "");
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          clearTimeout(leaveTimer.current);
          leaveTimer.current = setTimeout(() => {
            hoverOpened.current = false;
            menu.current?.removeAttribute("open");
          }, 160);
        }}
        onToggle={() => {
          if (!menu.current?.open) hoverOpened.current = false;
        }}
      >
        <summary
          aria-label={`Tài khoản ${user.displayName}`}
          onClick={(event) => {
            // A mouse click on a hover-opened menu keeps it open instead of
            // toggling it shut; keyboard activation (detail 0) still toggles.
            if (event.detail > 0 && hoverOpened.current) event.preventDefault();
          }}
        >
          <Avatar name={user.displayName} image={user.avatarUrl} />
        </summary>
        <div
          className="account-menu-panel"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a"))
              menu.current?.removeAttribute("open");
          }}
        >
          <div className="account-menu-identity">
            <strong>{user.displayName}</strong>
            <span className="helper">{user.email}</span>
            <span className="helper">{LABEL_BY_ROLE[user.role]}</span>
          </div>
          <Link href="/account" className="menu-item">
            Tài khoản của tôi
          </Link>
          <Link href="/notifications" className="menu-item">
            Thông báo
          </Link>
          {user.role === "TRAVELER" && (
            <>
              <Link href="/roll" className="menu-item">
                Hôm nay ăn gì?
              </Link>
              <Link href={roadmapRoutes.list} className="menu-item">
                Lộ trình của tôi
              </Link>
              <Link href={roadmapRoutes.plan} className="menu-item">
                Lập lộ trình mới
              </Link>
              <Link href="/guides/mine" className="menu-item">
                Bài viết của tôi
              </Link>
              <Link href="/guides/new" className="menu-item">
                Viết cẩm nang
              </Link>
            </>
          )}
          <Link href="/" className="menu-item">
            Trang chủ ANGI
          </Link>
          <LogoutButton />
        </div>
      </details>
    </>
  );
}
