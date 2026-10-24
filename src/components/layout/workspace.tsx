"use client";
import Link from "next/link";
import "@/styles/legacy-workspace.css";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthUserDto, RoleCode } from "@/features/auth/types";
import { LogoutButton } from "@/features/auth/session-panel";
import { PlatformProvider, usePlatform } from "@/features/platform/provider";
import { initialData } from "@/mocks/fixtures";
import type { AppData, DataMode } from "@/features/platform/contracts";
import { Avatar, Icon, ActionLink } from "@/components/ui/primitives";
import Brand from "@/components/brand";
import { ProvinceField } from "@/components/domain/province-field";
import { useProfile } from "@/api/services/profile-service";
import { notificationService } from "@/api/services/notification-service";

export const navigation: Record<RoleCode, [string, string][]> = {
  TRAVELER: [
    ["", "Khám phá"],
    ["roadmaps", "Lịch ăn của tôi"],
    ["guides", "Cẩm nang"],
    ["preferences", "Khẩu vị"],
    ["notifications", "Thông báo"],
    ["profile", "Hồ sơ"],
  ],
  RESTAURANT_OWNER: [
    ["", "Tổng quan"],
    ["profile", "Nhà hàng của tôi"],
    ["verification", "Xác minh nhà hàng"],
    ["menu", "Thực đơn"],
    ["reviews", "Đánh giá"],
    ["notifications", "Thông báo"],
    ["account", "Tài khoản"],
  ],
  MOD: [
    ["", "Công việc kiểm duyệt"],
    ["users", "Người dùng"],
    ["restaurants", "Nhà hàng"],
    ["verification", "Xác minh nhà hàng"],
    ["menus", "Duyệt thực đơn"],
    ["reports", "Báo cáo vi phạm"],
    ["community", "Nội dung cộng đồng"],
    ["reviews", "Đánh giá & phản hồi"],
    ["notifications", "Thông báo"],
    ["account", "Tài khoản"],
  ],
  ADMIN: [
    ["", "Tổng quan"],
    ["moderators", "Mod và phân quyền"],
    ["audit", "Nhật ký hệ thống"],
    ["sync", "Đồng bộ dữ liệu"],
  ],
};
const WorkspaceContext = createContext<{
  user: AuthUserDto | null;
  base: string;
  demo: boolean;
}>({ user: null, base: "", demo: false });
export const useWorkspace = () => useContext(WorkspaceContext);
export function WorkspaceScope({
  base,
  children,
}: {
  base: string;
  children: ReactNode;
}) {
  const scope = useWorkspace();
  return (
    <WorkspaceContext.Provider value={{ ...scope, base }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div className="between">
        <h1>{title}</h1>
        {action}
      </div>
      {description && <p>{description}</p>}
    </div>
  );
}
function Nav({ items, base }: { items: [string, string][]; base: string }) {
  const path = usePathname();
  return (
    <nav className="workspace-nav" aria-label="Điều hướng không gian">
      {items.map(([slug, label]) => {
        const href = base + (slug ? `/${slug}` : "");
        const active = slug
          ? path === href || path.startsWith(href + "/")
          : path === href;
        return (
          <Link
            key={slug}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
function Header({ base, demo }: { base: string; demo: boolean }) {
  const { user } = useWorkspace();
  const router = useRouter(),
    path = usePathname(),
    [search, setSearch] = useState("");
  const traveler = !user || user.role === "TRAVELER";
  const publicBase = demo ? "/demo/guest" : "";
  const menuRef = useRef<HTMLDetailsElement>(null);
  // Đóng dropdown tài khoản khi điều hướng (bấm link bên trong)
  useEffect(() => {
    if (menuRef.current) menuRef.current.removeAttribute("open");
  }, [path]);
  // Đóng dropdown khi bấm ra vùng khác, cuộn trang, hoặc nhấn Esc —
  // không cần bấm lại avatar.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const close = () => menu.removeAttribute("open");
    const onPointerDown = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        (menu.querySelector("summary") as HTMLElement | null)?.focus();
      }
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
  }, [user]);
  // Số thông báo chưa đọc lấy từ NotificationService (BE live → fallback
  // mock nếu DB/endpoint chưa có). Refresh nhẹ mỗi 60s để badge cập
  // nhật ngay cả khi user không mở trang.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = () => {
      notificationService
        .unreadCount()
        .then((res) => {
          if (!cancelled) setUnread(res.unreadCount);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);
  return (
    <header className={`container header ${traveler ? "" : "header-staff"}`}>
      <Brand href={base || "/"} />
      {(traveler || user?.role === "ADMIN") && (
        <nav className="header-links" aria-label="Điều hướng công khai">
          {[
            [traveler ? base || "/" : publicBase || "/", "Trang chủ"],
            [
              traveler ? `${base}/guides` : `${publicBase}/guides`,
              "Cẩm nang ẩm thực",
            ],
            [
              traveler ? `${base}/restaurants` : `${publicBase}/restaurants`,
              "Quán ăn",
            ],
            [traveler ? `${base}/dishes` : `${publicBase}/dishes`, "Món ăn"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {traveler && (
        <form
          className="header-search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`${base}/restaurants?q=${encodeURIComponent(search)}`);
          }}
        >
          <Icon name="search" />
          <ProvinceField
            label="Tìm địa điểm hoặc nhà hàng"
            value={search}
            onChange={setSearch}
            placeholder="Nhập địa điểm hoặc nhà hàng"
            autoComplete="off"
            showCatalogStatus={false}
          />
        </form>
      )}
      <div
        className="actions"
        style={!traveler ? { marginLeft: "auto" } : undefined}
      >
        {user ? (
          <>
            <Link
              href={`${base}/notifications`}
              className={`bell-cta ${path.startsWith(`${base}/notifications`) ? "is-active" : ""}`}
              aria-label={
                unread > 0
                  ? `Thông báo, ${unread} chưa đọc`
                  : "Thông báo"
              }
            >
              <span className="bell-cta-icon">
                <Icon name="bell" />
                {unread > 0 && (
                  <span className="notification-badge" aria-hidden>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
            </Link>
            <details className="account-menu" ref={menuRef}>
              <summary aria-label={`Tài khoản ${user.displayName}`}>
                <Avatar name={user.displayName} image={user.avatarUrl} />
              </summary>
              <div
                onClick={(e) => {
                  // Đóng menu khi bấm vào link/logout bên trong
                  const target = e.target as HTMLElement;
                  if (target.closest("a, button")) {
                    menuRef.current?.removeAttribute("open");
                  }
                }}
              >
                <p>{user.displayName}</p>
                <p className="helper">{user.email}</p>
                <Link
                  href={`${base}/${user.role === "TRAVELER" ? "profile" : "account"}`}
                >
                  Tài khoản của tôi
                </Link>
                {user.role === "TRAVELER" && (
                  <>
                    <Link href={`${base}/roadmaps`}>Lịch ăn của tôi</Link>
                    <Link href={`${base}/my-guides`}>Bài viết của tôi</Link>
                  </>
                )}
                <LogoutButton />
              </div>
            </details>
          </>
        ) : (
          <ActionLink href="/login" secondary>
            Đăng nhập
          </ActionLink>
        )}
      </div>
    </header>
  );
}
export function PublicFooter({ base = "" }: { base?: string }) {
  const { user } = useWorkspace();
  return (
    <footer className="container public-footer">
      <section>
        <Brand />
        <p>
          Khám phá món ngon cùng ANGI
          <br />© 2026 ANGI
        </p>
      </section>
      <section>
        <h2>ANGI</h2>
        <Link href={`${base}/restaurants`}>Quán ăn</Link>
        <Link href={`${base}/guides`}>Cẩm nang ẩm thực</Link>
        <Link href={`${base}/dishes`}>Món ăn</Link>
      </section>
      <section>
        <h2>Hướng dẫn và tài nguyên</h2>
        <Link
          href={user?.role === "TRAVELER" ? `${base}/roadmaps/new` : "/login"}
        >
          Lập lịch ăn theo khu vực
        </Link>
        <Link href={`${base}/guides`}>Khám phá ẩm thực vùng miền</Link>
        <Link
          href={user?.role === "TRAVELER" ? `${base}/preferences` : "/login"}
        >
          Hồ sơ khẩu vị
        </Link>
      </section>
    </footer>
  );
}
export function WorkspaceShell({
  user,
  children,
  base,
  demo = false,
  mode = "demo",
  seed,
}: {
  user: AuthUserDto | null;
  children: ReactNode;
  base: string;
  demo?: boolean;
  mode?: DataMode;
  seed?: AppData;
}) {
  const path = usePathname(),
    isRoadmap = /(\/roadmaps\/)(?!new|share)[^/]+$/.test(path),
    isTraveler = !user || user.role === "TRAVELER";
  const label =
    user?.role === "ADMIN"
      ? "KHÔNG GIAN QUẢN TRỊ"
      : user?.role === "MOD"
        ? "KHÔNG GIAN KIỂM DUYỆT"
        : "DÀNH CHO CHỦ NHÀ HÀNG";
  const dataSeed = seed ?? initialData;
  const roleSeed = {
    ...dataSeed,
    profile: {
      ...dataSeed.profile,
      name: user?.displayName ?? dataSeed.profile.name,
    },
  };
  return (
    <WorkspaceContext.Provider value={{ user, base, demo }}>
      <PlatformProvider mode={mode} seed={roleSeed}>
        <ProfileIdentity>
          <a className="skip-link" href="#main-content">
            Đến nội dung chính
          </a>
          <Header base={base} demo={demo} />
          {!isTraveler ? (
            <main className="container workspace" id="main-content">
              <div className="between workspace-identity">
                <span className="eyebrow">{label}</span>
                {mode === "demo" && (
                  <span className="helper">Dữ liệu minh họa</span>
                )}
              </div>
              {user?.role === "ADMIN" ? (
                <div className="grouped-navigation">
                  <div className="nav-group">
                    <span>Quản trị</span>
                    <Nav items={navigation.ADMIN} base={base} />
                  </div>
                  <div className="nav-group">
                    <span>Kiểm duyệt</span>
                    <Nav
                      items={navigation.MOD.slice(1, 8)}
                      base={demo ? base + "/moderation" : "/moderation"}
                    />
                  </div>
                </div>
              ) : (
                <Nav items={navigation[user!.role]} base={base} />
              )}
              <div>{children}</div>
            </main>
          ) : (
            <main
              id="main-content"
              className={isRoadmap ? "" : "traveler-content"}
            >
              {children}
            </main>
          )}
          {!isRoadmap &&
            (isTraveler ? (
              <PublicFooter base={base} />
            ) : (
              <footer className="container footer">
                <span>ANGI · {label.toLocaleLowerCase("vi")} · © 2026</span>
                <span>Tiếng Việt</span>
              </footer>
            ))}
        </ProfileIdentity>
      </PlatformProvider>
    </WorkspaceContext.Provider>
  );
}
function ProfileIdentity({ children }: { children: ReactNode }) {
  const scope = useWorkspace(),
    { data, mode, setSilent } = usePlatform();
  // Always pull the BE profile when signed in. `useProfile()` returns
  // `null` for `profile` when /me fails (no session, network error), so
  // the `!live.profile` guard keeps the mock in place for unauthenticated
  // previews. Once a real user is signed in (any route, including
  // /demo/...) their data flows into the platform store and the rest of
  // the app reads the real session.
  const live = useProfile();
  // Track the last `id` we synced so we only push into the platform
  // store when the BE actually returns a different user (e.g. login,
  // logout, switch account). Without this guard the hook returns a new
  // object reference every render and we'd loop `setSilent → data →
  // render → setSilent ...` until React throws "Too many re-renders".
  const lastSyncedId = useRef<number | null>(null);
  useEffect(() => {
    if (!live.profile) return;
    if (lastSyncedId.current === live.profile.id) return;
    lastSyncedId.current = live.profile.id;
    setSilent((d) => {
      d.profile = {
        name: live.profile!.displayName,
        phone: live.profile!.phone ?? "",
        bio: live.profile!.bio ?? "",
        avatar: live.profile!.avatarUrl ?? "",
      };
    });
  }, [live.profile, setSilent]);
  const user =
    scope.user && mode === "demo"
      ? {
          ...scope.user,
          displayName: data.profile.name,
          // In demo mode the layout injects a mock user, but when a real
          // user is signed in we want the BE email/avatar to win too.
          email: live.profile?.email ?? scope.user.email,
          avatarUrl: data.profile.avatar
            ? data.profile.avatar
            : (live.profile?.avatarUrl ?? null),
        }
      : scope.user;
  return (
    <WorkspaceContext.Provider value={{ ...scope, user }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
