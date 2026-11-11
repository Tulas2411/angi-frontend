"use client";
import { useState } from "react";
import { Alert, Card } from "@/shared/ui";
import {
  ActionLink,
  Media,
} from "@/components/ui/primitives";
import {
  RestaurantStatuses,
  submissionLabels,
} from "@/components/domain/cards";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";

import { EmptyState } from "@/components/ui/primitives";
import { RestaurantRegistrationPage } from "./restaurant-registration-page";
import { RestaurantProfilePage } from "./restaurant-profile-page";
import { RestaurantBusinessHoursPage } from "./restaurant-business-hours-page";
import { RestaurantOperatingStatusPage } from "./restaurant-operating-status-page";
import { RestaurantVerificationPage } from "./restaurant-verification-page";
import { RestaurantMenuPage } from "./restaurant-menu-page";

export function OwnerOverview() {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    restaurant = data.restaurants.find((r) => r.id === data.ownerRestaurantId),
    menu = data.submissions.find((s) => s.kind === "menu");
  if (!restaurant)
    return (
      <div className="stack">
        <PageHeading
          title="Chào bạn, bắt đầu với nhà hàng của mình nhé."
          description="Đăng ký thông tin nhà hàng trước khi quản lý thực đơn và gửi hồ sơ xác minh."
        />
        <Card>
          <EmptyState
            title="Bạn chưa có nhà hàng"
            action={
              <ActionLink href={`${base}/profile`}>Đăng ký nhà hàng</ActionLink>
            }
          />
        </Card>
      </div>
    );
  return (
    <div className="stack">
      <PageHeading
        title={`Một ngày mới tại ${restaurant.name}.`}
        description="Những việc cần làm và trạng thái nhà hàng, rõ ràng tại một nơi."
      />
      <Card className="elevated">
        <div className="profile-card">
          <Media src={restaurant.image} alt={restaurant.name} />
          <div className="stack-sm">
            <h2>{restaurant.name}</h2>
            <p>{restaurant.address}</p>
            <p className="helper">Cập nhật minh họa: 03/10/2026 · 09:20</p>
            <ActionLink href={`${base}/profile`} secondary>
              Quản lý nhà hàng
            </ActionLink>
          </div>
        </div>
      </Card>
      <RestaurantStatuses restaurant={restaurant} />
      {menu && (
        <Alert tone="info">
          Bạn có một bản thực đơn · {submissionLabels[menu.status]}. Thực đơn
          hiện tại vẫn phục vụ khách trong khi bạn chỉnh sửa.
        </Alert>
      )}
      <div className="grid-2">
        <Card className="elevated" title="Tiếp tục thực đơn">
          <p>Hoàn tất nội dung, kiểm tra thay đổi rồi gửi duyệt.</p>
          <ActionLink href={`${base}/menu`}>Tiếp tục thực đơn</ActionLink>
        </Card>
        <Card className="elevated" title="Lắng nghe thực khách">
          <p>Đọc đánh giá và trả lời trong đúng ngữ cảnh.</p>
          <ActionLink href={`${base}/reviews`} secondary>
            Xem đánh giá
          </ActionLink>
        </Card>
      </div>
      <div className="actions">
        <ActionLink href={`${base}/profile?tab=hours`} secondary>
          Giờ mở cửa
        </ActionLink>
        <ActionLink href={`${base}/profile?tab=photos`} secondary>
          Hình ảnh nhà hàng
        </ActionLink>
        <ActionLink href={`${base}/notifications`} secondary>
          Thông báo ·{" "}
          {
            data.notices.filter((n) => n.role === "RESTAURANT_OWNER" && !n.read)
              .length
          }{" "}
          chưa đọc
        </ActionLink>
      </div>
    </div>
  );
}
export function OwnerRestaurant({
  initialTab = "information",
}: {
  initialTab?: string;
}) {
  const { data } = usePlatform();
  // Keep the onboarding component mounted when its mutation publishes the new restaurant.
  const [registering] = useState(
    () =>
      !data.restaurants.some(
        (restaurant) => restaurant.id === data.ownerRestaurantId,
      ),
  );
  if (registering) return <RestaurantRegistrationPage />;
  if (initialTab === "hours") return <RestaurantBusinessHoursPage />;
  if (initialTab === "status") return <RestaurantOperatingStatusPage />;
  return <RestaurantProfilePage initialTab={initialTab} />;
}

export function VerificationPage({ initialTab }: { initialTab?: string }) {
  return <RestaurantVerificationPage initialTab={initialTab} />;
}
export function OwnerMenuPage() {
  return <RestaurantMenuPage />;
}
