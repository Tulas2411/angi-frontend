"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  ArrowPathIcon,
  Bars3Icon,
  BellIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  FlagIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  StarIcon,
  UserCircleIcon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Brand from "@/components/brand";
import { Avatar } from "@/components/ui/primitives";
import { LogoutButton } from "@/features/auth/session-panel";
import type { AuthUserDto } from "@/features/auth/types";
import "./admin-shell.css";

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** One icon per workspace slug (Heroicons outline). */
const icons: Record<string, HeroIcon> = {
  "": Squares2X2Icon,
  moderators: UserGroupIcon,
  permissions: ShieldCheckIcon,
  audit: ClipboardDocumentListIcon,
  sync: ArrowPathIcon,
  users: UsersIcon,
  restaurants: BuildingStorefrontIcon,
  verification: CheckBadgeIcon,
  menus: BookOpenIcon,
  reports: FlagIcon,
  community: ChatBubbleLeftRightIcon,
  reviews: StarIcon,
};

export interface SidebarGroup {
  title: string;
  base: string;
  items: [slug: string, label: string][];
}

function SidebarNav({
  groups,
  label,
}: {
  groups: SidebarGroup[];
  label: string;
}) {
  const path = usePathname();
  return (
    <nav className="admin-sidebar-nav" aria-label={`Điều hướng ${label}`}>
      {groups.map((group) => (
        <div key={group.title} className="admin-sidebar-group">
          <p>{group.title}</p>
          <ul>
            {group.items.map(([slug, label]) => {
              const href = group.base + (slug ? `/${slug}` : "");
              const active = slug
                ? path === href || path.startsWith(`${href}/`)
                : path === href;
              const Icon = icons[slug] ?? Squares2X2Icon;
              return (
                <li key={href}>
                  <Link href={href} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * A staff workspace as a dashboard (Admin and Mod): no site header, a fixed sidebar with the
 * sections, the account at its foot; on a phone the sidebar is a drawer.
 */
export function AdminShell({
  user,
  base,
  groups,
  unread,
  demo,
  label = "quản trị",
  children,
}: {
  user: AuthUserDto;
  base: string;
  groups: SidebarGroup[];
  unread: number;
  demo: boolean;
  /** The workspace in lower case: "quản trị" or "kiểm duyệt". */
  label?: string;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  // A link followed in the drawer closes it.
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const notificationsHref = `${base}/notifications`;

  return (
    <div className="admin-shell" data-drawer={open || undefined}>
      <div className="admin-topbar">
        <Brand href={base || "/"} />
        <button
          type="button"
          className="admin-menu-button"
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={open ? `Đóng menu ${label}` : `Mở menu ${label}`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <XMarkIcon aria-hidden /> : <Bars3Icon aria-hidden />}
        </button>
      </div>
      <button
        type="button"
        className="admin-backdrop"
        aria-label={`Đóng menu ${label}`}
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
      <aside id={drawerId} className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Brand href={base || "/"} />
          <span>
            {label}
            {demo ? " · minh họa" : ""}
          </span>
        </div>
        <SidebarNav groups={groups} label={label} />
        <div className="admin-sidebar-foot">
          <Link
            href={notificationsHref}
            className="admin-sidebar-bell"
            aria-current={
              path.startsWith(notificationsHref) ? "page" : undefined
            }
            aria-label={
              unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"
            }
          >
            <BellIcon aria-hidden />
            <span aria-hidden>Thông báo</span>
            {unread > 0 && (
              <span className="admin-sidebar-badge" aria-hidden>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            href={`${base}/account`}
            className="admin-sidebar-account"
            aria-current={
              path.startsWith(`${base}/account`) ? "page" : undefined
            }
          >
            <Avatar name={user.displayName} image={user.avatarUrl} />
            <span>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
            </span>
            <UserCircleIcon aria-hidden />
          </Link>
          <div className="admin-sidebar-logout">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="admin-main" id="main-content">
        {children}
      </main>
    </div>
  );
}
