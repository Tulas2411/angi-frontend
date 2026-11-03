"use client";
import "./account-menu.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  FireIcon,
  GlobeAltIcon,
  HomeIcon,
  MapIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "@/components/ui/primitives";
import { LogoutButton } from "@/features/auth/logout-button";
import { HOME_BY_ROLE, LABEL_BY_ROLE } from "@/features/auth/roles";
import { NotificationBell } from "@/features/notifications/notification-bell";
import type { AuthUserDto } from "@/features/auth/types";
import { exploreRoutes } from "@/features/explore/explore-routes";
import { roadmapRoutes } from "@/features/roadmaps/routes";

/**
 * Signed-in header actions shared by the homepage and every protected page: a pill to the
 * account page, the notification bell, a home shortcut and a menu button that opens the
 * account drawer from the right.
 */
export function AccountMenu({ user }: { user: AuthUserDto }) {
  const home = HOME_BY_ROLE[user.role];
  const path = usePathname();
  // Open only on the page it was opened from, so any navigation closes the drawer.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === path;
  return (
    <>
      <Link
        href="/account"
        className="account-pill"
        aria-label={`Tài khoản ${user.displayName}`}
      >
        <Avatar name={user.displayName} image={user.avatarUrl} />
        <span className="account-pill-name">{user.displayName}</span>
      </Link>
      <NotificationBell role={user.role} />
      <Link
        href={home}
        className="header-icon-button header-home"
        aria-label="Trang chủ"
      >
        <HomeIcon aria-hidden />
      </Link>
      <button
        type="button"
        className="header-icon-button"
        aria-label="Mở menu tài khoản"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenedAt(path)}
      >
        <Bars3Icon aria-hidden />
      </button>
      <AccountDrawer
        user={user}
        home={home}
        open={open}
        onClose={() => setOpenedAt(null)}
      />
    </>
  );
}

/** Right-side drawer on a modal `<dialog>`: Escape, the backdrop and links close it. */
function AccountDrawer({
  user,
  home,
  open,
  onClose,
}: {
  user: AuthUserDto;
  home: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="account-drawer"
      aria-label="Menu tài khoản"
      onClose={onClose}
      onClick={(event) => {
        // The dialog box fills the drawer, so a click on the element itself is on the backdrop.
        if (event.target === event.currentTarget) onClose();
        else if ((event.target as HTMLElement).closest("a")) onClose();
      }}
    >
      <div className="account-drawer-panel">
        <div className="account-drawer-top">
          <button
            type="button"
            className="header-icon-button"
            aria-label="Đóng menu"
            onClick={onClose}
          >
            <XMarkIcon aria-hidden />
          </button>
        </div>
        <div className="account-drawer-identity">
          <Avatar name={user.displayName} image={user.avatarUrl} />
          <div>
            <strong>{user.displayName}</strong>
            <span className="helper">{user.email}</span>
            <span className="helper">{LABEL_BY_ROLE[user.role]}</span>
          </div>
        </div>
        <nav className="account-drawer-nav" aria-label="Tài khoản">
          <DrawerLink href={home} icon={<HomeIcon />}>
            Trang chủ
          </DrawerLink>
          <DrawerLink href="/account" icon={<UserCircleIcon />}>
            Tài khoản của tôi
          </DrawerLink>
          {/* A Traveler's home is the public homepage; the other roles still reach it from here. */}
          {home !== "/" && (
            <DrawerLink href="/" icon={<GlobeAltIcon />}>
              Trang chủ ANGI
            </DrawerLink>
          )}
          {user.role === "TRAVELER" && (
            <>
              <p className="account-drawer-group">Hành trình của tôi</p>
              <DrawerLink href={roadmapRoutes.list} icon={<MapIcon />}>
                Lộ trình của tôi
              </DrawerLink>
              <DrawerLink href="/guides/mine" icon={<DocumentTextIcon />}>
                Bài viết của tôi
              </DrawerLink>
              <p className="account-drawer-group">Khám phá ẩm thực</p>
              <DrawerLink href={exploreRoutes.dishes} icon={<FireIcon />}>
                Khám phá món ăn
              </DrawerLink>
              <DrawerLink
                href={exploreRoutes.restaurants}
                icon={<BuildingStorefrontIcon />}
              >
                Khám phá quán ăn
              </DrawerLink>
            </>
          )}
        </nav>
        <div className="account-drawer-footer">
          <LogoutButton
            className="account-drawer-logout"
            icon={<ArrowRightStartOnRectangleIcon aria-hidden />}
          />
        </div>
      </div>
    </dialog>
  );
}

function DrawerLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  return (
    <Link
      href={href}
      className="account-drawer-link"
      aria-current={path === href ? "page" : undefined}
    >
      <span className="account-drawer-icon" aria-hidden>
        {icon}
      </span>
      {children}
    </Link>
  );
}
