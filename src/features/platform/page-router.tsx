"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RoleCode } from "@/features/auth/types";
import { Button, Card, Alert } from "@/shared/ui";
import { ActionLink, EmptyState, Skeleton } from "@/components/ui/primitives";
import { usePlatform } from "./provider";
import { useWorkspace, WorkspaceScope } from "@/components/layout/workspace";
import {
  DiscoveryPage,
  DiscoveryList,
  RestaurantDetail,
} from "@/features/discovery/pages";
import { BlogDetail, BlogEditor, BlogList } from "@/features/blogs/pages";
import {
  AccountPage,
  NotificationsPage,
  PreferencesPage,
} from "@/features/profile/pages";
import {
  NewTripPage,
  RoadmapPage,
  RollDishPage,
  TripList,
} from "@/features/roadmaps/pages";
import {
  OwnerMenuPage,
  OwnerOverview,
  OwnerRestaurant,
  OwnerReviewsPage,
  VerificationPage,
} from "@/features/owner/pages";
import {
  AdminDashboard,
  AuditPage,
  ModeratorDirectory,
  PermissionEditor,
  SyncPage,
} from "@/features/admin/pages";
import {
  CommunityPage,
  ModerationOverview,
  ModerationRestaurants,
  ModerationReviews,
  ModerationUsers,
  ReportsPage,
  SubmissionQueue,
} from "@/features/moderation/pages";
import { AuthFlowPage, type AuthFlow } from "@/features/auth/flows";

export function UnavailablePage() {
  const [attempts, setAttempts] = useState(0);
  const { status, reload } = usePlatform();
  if (status === "loading")
    return (
      <div className="container workspace">
        <Skeleton />
      </div>
    );
  return (
    <div className="container page-error stack">
      <Card title="Dữ liệu thực chưa khả dụng">
        <Alert tone="warning">
          Dữ liệu của mục này chưa được kết nối. Hiện bạn có thể xem và thử các
          thao tác với dữ liệu minh họa.
        </Alert>
        <p>
          Bạn có thể xem màn hình và tương tác với dữ liệu minh họa ở đường dẫn
          riêng.
        </p>
        <div className="actions">
          <Button
            variant="secondary"
            onClick={() => {
              setAttempts((n) => n + 1);
              void reload();
            }}
          >
            Thử lại
          </Button>
          <ActionLink href="/demo" secondary>
            Mở bản minh họa
          </ActionLink>
        </div>
        {attempts > 0 && (
          <p role="status">
            Dữ liệu thực vẫn chưa khả dụng. Thử lại sau hoặc mở bản minh họa.
          </p>
        )}
      </Card>
    </div>
  );
}
function ModPages({ segments }: { segments: string[] }) {
  const [area, id] = segments;
  if (!area) return <ModerationOverview />;
  if (area === "users") return <ModerationUsers id={id} />;
  if (area === "restaurants") return <ModerationRestaurants id={id} />;
  if (area === "verification" || area === "menus")
    return (
      <SubmissionQueue
        kind={area === "menus" ? "menu" : "verification"}
        id={id}
      />
    );
  if (area === "reports") return <ReportsPage id={id} />;
  if (area === "community") return <CommunityPage />;
  if (area === "reviews") return <ModerationReviews />;
  if (area === "notifications") return <NotificationsPage />;
  if (area === "account") return <AccountPage />;
  return <MissingPage />;
}
function MissingPage() {
  const { base } = useWorkspace();
  return (
    <div className="container workspace">
      <EmptyState
        title="Không tìm thấy trang"
        action={<ActionLink href={base || "/"}>Về trang chủ</ActionLink>}
      />
    </div>
  );
}
export function PageRouter({
  role,
  segments = [],
}: {
  role: RoleCode | "GUEST";
  segments?: string[];
}) {
  const { status } = usePlatform(),
    { base, demo } = useWorkspace(),
    params = useSearchParams();
  const [area, id, operation] = segments;
  if (status !== "ready") return <UnavailablePage />;
  if (
    [
      "register",
      "forgot-password",
      "reset-password",
      "verify-email",
      "setup-password",
      "choose-role",
    ].includes(area)
  )
    return <AuthFlowPage flow={area as AuthFlow} demo={demo} />;
  if (role === "GUEST" || role === "TRAVELER") {
    if (!area) return <DiscoveryPage />;
    if (area === "restaurants")
      return id ? (
        <RestaurantDetail id={id} />
      ) : (
        <DiscoveryList kind="restaurants" />
      );
    if (area === "dishes") return <DiscoveryList kind="dishes" />;
    if (
      role === "GUEST" &&
      area === "guides" &&
      (id === "new" || operation === "edit")
    )
      return (
        <div className="container workspace">
          <Card title="Đăng nhập để viết cẩm nang">
            <ActionLink href="/login">Đăng nhập</ActionLink>
          </Card>
        </div>
      );
    if (area === "guides")
      return id === "new" ? (
        <BlogEditor />
      ) : id ? (
        operation === "edit" ? (
          <BlogEditor id={id} />
        ) : (
          <BlogDetail id={id} />
        )
      ) : (
        <BlogList />
      );
    if (role === "TRAVELER") {
      if (area === "my-guides") return <BlogList mine />;
      if (area === "profile" || area === "account")
        return <AccountPage profile />;
      if (area === "preferences" || area === "survey")
        return <PreferencesPage survey={area === "survey"} />;
      if (area === "notifications") return <NotificationsPage />;
      if (area === "roll") return <RollDishPage />;
      if (area === "roadmaps")
        return id === "new" ? (
          <NewTripPage />
        ) : id === "share" ? (
          <BlogEditor share />
        ) : id ? (
          <RoadmapPage id={id} />
        ) : (
          <TripList />
        );
    }
  }
  if (role === "RESTAURANT_OWNER") {
    if (!area) return <OwnerOverview />;
    if (area === "profile")
      return (
        <OwnerRestaurant initialTab={params.get("tab") ?? "information"} />
      );
    if (area === "verification") return <VerificationPage />;
    if (area === "menu") return <OwnerMenuPage />;
    if (area === "reviews") return <OwnerReviewsPage />;
    if (area === "notifications") return <NotificationsPage />;
    if (area === "account") return <AccountPage />;
  }
  if (role === "MOD") return <ModPages segments={segments} />;
  if (role === "ADMIN") {
    if (!area) return <AdminDashboard />;
    if (area === "moderators")
      return operation === "permissions" ? (
        <PermissionEditor id={id} />
      ) : (
        <ModeratorDirectory id={id} />
      );
    if (area === "permissions") return <PermissionEditor />;
    if (area === "audit") return <AuditPage />;
    if (area === "sync") return <SyncPage />;
    if (area === "moderation")
      return (
        <WorkspaceScope base={`${base}/moderation`}>
          <ModPages segments={segments.slice(1)} />
        </WorkspaceScope>
      );
    if (area === "notifications") return <NotificationsPage />;
    if (area === "account") return <AccountPage />;
  }
  return <MissingPage />;
}
