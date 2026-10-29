"use client";
import { useState } from "react";
import { redirect, useSearchParams } from "next/navigation";
import type { RoleCode } from "@/features/auth/types";
import { Button, Card, Alert } from "@/shared/ui";
import { ActionLink, EmptyState, Skeleton } from "@/components/ui/primitives";
import { usePlatform } from "./provider";
import { useWorkspace, WorkspaceScope } from "@/components/layout/workspace";
import { AccountPage } from "@/features/profile/pages";
import { NewTripPage, RoadmapPage, TripList } from "@/features/roadmaps/pages";
import {
  OwnerMenuPage,
  OwnerOverview,
  OwnerRestaurant,
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
import { RestaurantRegistrationPage } from "@/features/owner/restaurant-registration-page";
import { RestaurantProfilePage } from "@/features/owner/restaurant-profile-page";
import { RestaurantBusinessHoursPage } from "@/features/owner/restaurant-business-hours-page";
import { RestaurantOperatingStatusPage } from "@/features/owner/restaurant-operating-status-page";
import { RestaurantReviewsPage } from "@/features/owner/restaurant-reviews-page";
import { RestaurantReviewsLivePage } from "@/features/owner/restaurant-reviews-live-page";
import {
  ModerationReportsPage,
  ModerationReportDetailPage,
} from "@/features/moderation/moderation-reports-page";
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
/**
 * Báo cáo vi phạm trong live mode: danh sách (MOD-RP1) hoặc chi tiết (MOD-RP2).
 * Không phụ thuộc AppData nên đứng trước cổng `status !== "ready"`.
 */
function ModReportsBase({ base, id }: { base: string; id?: string }) {
  const reportId = Number(id);
  return Number.isInteger(reportId) && reportId > 0 ? (
    <ModerationReportDetailPage base={base} reportId={reportId} />
  ) : (
    <ModerationReportsPage base={base} />
  );
}

function ModPages({ segments }: { segments: string[] }) {
  const [area, id] = segments;
  const { base } = useWorkspace();
  const { mode } = usePlatform();
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
  // MOD-RP1..MOD-RP4 đã nối API nên bản live đọc thật; bản demo giữ dữ liệu mẫu.
  if (area === "reports")
    return mode === "live" ? (
      <ModReportsBase base={base} id={id} />
    ) : (
      <ReportsPage id={id} />
    );
  if (area === "community") return <CommunityPage />;
  if (area === "reviews") return <ModerationReviews />;
  if (area === "notifications") return <NotificationsRedirect />;
  if (area === "account") return <AccountPage />;
  return <MissingPage />;
}
/** Notifications moved to the shared /notifications screen (NOTI-01..03) for every role. */
function NotificationsRedirect(): never {
  redirect("/notifications");
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
  const { status, mode } = usePlatform(),
    { base, demo } = useWorkspace(),
    params = useSearchParams();
  const [area, id, operation] = segments;
  // Before the workspace data: the shared screen reads NOTI-01 itself.
  if (role !== "GUEST" && area === "notifications")
    return <NotificationsRedirect />;
  if (
    role === "RESTAURANT_OWNER" &&
    mode === "live" &&
    area === "profile" &&
    params.get("tab") === "status"
  )
    return <RestaurantOperatingStatusPage />;
  if (
    role === "RESTAURANT_OWNER" &&
    mode === "live" &&
    area === "profile" &&
    params.get("tab") === "hours"
  )
    return <RestaurantBusinessHoursPage />;

  if (role === "RESTAURANT_OWNER" && mode === "live" && area === "profile")
    return (
      <RestaurantProfilePage initialTab={params.get("tab") ?? "information"} />
    );

  // These operations do not depend on the AppData adapter.
  if (role === "RESTAURANT_OWNER" && mode === "live" && area === "menu")
    return <OwnerMenuPage />;

  if (role === "RESTAURANT_OWNER" && mode === "live" && area === "verification")
    return <VerificationPage initialTab={params.get("tab") ?? undefined} />;

  // OWN-19/OWN-20 đã nối API nên bản live đọc thật, không phụ thuộc AppData.
  if (role === "RESTAURANT_OWNER" && mode === "live" && area === "reviews")
    return <RestaurantReviewsLivePage />;

  // MOD-RP1..MOD-RP4 đã nối API nên bản live đọc thật, không phụ thuộc AppData.
  if (mode === "live" && (role === "MOD" || role === "ADMIN") && area === "reports")
    return (
      <ModReportsBase base={base} id={id} />
    );

  if (
    role === "RESTAURANT_OWNER" &&
    (area === "register" || (mode === "live" && !area))
  )
    return <RestaurantRegistrationPage />;

  if (status !== "ready") {
    return <UnavailablePage />;
  }
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
    if (role === "TRAVELER") {
      if (area === "profile" || area === "account")
        return <AccountPage profile={id === "edit"} />;
      // F-18 moved to /roll, on DISH-03.
      if (area === "roll") redirect("/roll");
      if (area === "roadmaps")
        return id === "new" ? (
          <NewTripPage />
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
    if (area === "verification")
      return <VerificationPage initialTab={params.get("tab") ?? undefined} />;
    if (area === "menu") return <OwnerMenuPage />;
    if (area === "reviews")
      // OWN-19/OWN-20 đã nối API nên bản live đọc thật; bản demo giữ dữ liệu mẫu.
      return mode === "live" ? (
        <RestaurantReviewsLivePage />
      ) : (
        <RestaurantReviewsPage />
      );
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
    if (area === "account") return <AccountPage />;
  }
  return <MissingPage />;
}
