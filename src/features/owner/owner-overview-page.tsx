"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  EmptyState,
  Media,
  Skeleton,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/page-heading";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { menuStatusLabels } from "./menu-rules";
import { restaurantService } from "./restaurant-service";
import type { OwnerRestaurantDto } from "./restaurant-types";
import { ownerProfileHref, ownerRoutes, ownerVerificationHref } from "./routes";
import { RestaurantStatusGrid } from "./status-labels";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; restaurant: OwnerRestaurantDto };

/** Summary built only from OWN-02: profile, the three independent statuses and the open menu draft. */
export function OwnerOverviewPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    restaurantService
      .getOwnerRestaurant()
      .then((restaurant) => {
        if (!ignore) setState({ status: "ready", restaurant });
      })
      .catch((caught) => {
        if (ignore) return;
        setState(
          caught instanceof ApiError &&
            caught.errorCode === "RESTAURANT_NOT_FOUND"
            ? { status: "missing" }
            : { status: "error", message: getErrorMessage(caught) },
        );
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);
  if (state.status === "loading")
    return (
      <div className="stack">
        <PageHeading title="Tổng quan nhà hàng" />
        <Skeleton />
      </div>
    );
  if (state.status === "missing")
    return (
      <div className="stack">
        <PageHeading
          eyebrow="Dành cho chủ nhà hàng"
          title="Bắt đầu với nhà hàng của bạn."
          description="Đăng ký thông tin nhà hàng trước khi gửi hồ sơ xác minh và quản lý thực đơn."
        />
        <Card>
          <EmptyState
            title="Bạn chưa có nhà hàng"
            action={
              <ActionLink href={ownerRoutes.register}>
                Đăng ký nhà hàng
              </ActionLink>
            }
          >
            Mỗi tài khoản chủ nhà hàng đăng ký một nhà hàng.
          </EmptyState>
        </Card>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="stack">
        <PageHeading title="Tổng quan nhà hàng" />
        <Card title="Chưa tải được thông tin nhà hàng">
          <Alert>{state.message}</Alert>
          <div className="actions">
            <Button
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại
            </Button>
          </div>
        </Card>
      </div>
    );
  return <Overview restaurant={state.restaurant} />;
}

function Overview({ restaurant }: { restaurant: OwnerRestaurantDto }) {
  const location = [restaurant.ward, restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="stack">
      <PageHeading
        eyebrow="Dành cho chủ nhà hàng"
        title={restaurant.name}
        description="Trạng thái nhà hàng và các việc cần làm tiếp theo, rõ ràng tại một nơi."
      />
      <Card className="overview-profile">
        <Media src={restaurant.coverUrl ?? undefined} alt={restaurant.name} />
        <div className="stack-sm">
          <h2>{restaurant.name}</h2>
          <p>
            {[restaurant.addressLine, location].filter(Boolean).join(" · ")}
          </p>
          {restaurant.phone && <p className="helper">{restaurant.phone}</p>}
          <div className="actions">
            <ActionLink href={ownerProfileHref()} secondary>
              Quản lý hồ sơ
            </ActionLink>
          </div>
        </div>
      </Card>
      <Card title="Trạng thái nhà hàng">
        <RestaurantStatusGrid restaurant={restaurant} />
        <p className="helper">
          Xác minh do kiểm duyệt viên quyết định, hoạt động do bạn đặt, kiểm
          duyệt do kiểm duyệt viên đặt — ba trạng thái độc lập với nhau.
        </p>
      </Card>
      <NextSteps restaurant={restaurant} />
      <div className="grid-2">
        <QuickLink
          href={ownerProfileHref("hours")}
          title="Giờ mở cửa"
          text="Khai báo lịch phục vụ trong tuần, gồm nhiều khoảng và giờ qua đêm."
        />
        <QuickLink
          href={ownerProfileHref("status")}
          title="Trạng thái hoạt động"
          text="Mở cửa, tạm đóng hoặc đóng cửa vĩnh viễn kèm lý do."
        />
        <QuickLink
          href={ownerVerificationHref("status")}
          title="Hồ sơ xác minh"
          text="Theo dõi kết quả duyệt và phản hồi của kiểm duyệt viên."
        />
        <QuickLink
          href={ownerRoutes.menu}
          title="Thực đơn"
          text="Quản lý món đang bán, bản nháp và lịch sử gửi duyệt."
        />
      </div>
    </div>
  );
}

function NextSteps({ restaurant }: { restaurant: OwnerRestaurantDto }) {
  const menu = restaurant.openMenuSubmission;
  return (
    <div className="stack-sm">
      {restaurant.verificationStatus === "unverified" && (
        <Alert tone="info">
          Nhà hàng chưa hiển thị công khai. Gửi hồ sơ xác minh để bắt đầu tạo
          thực đơn.{" "}
          <Link href={ownerRoutes.verification} className="text-link">
            Gửi hồ sơ xác minh
          </Link>
        </Alert>
      )}
      {restaurant.verificationStatus === "pending" && (
        <Alert tone="info">
          Hồ sơ xác minh đang chờ duyệt.{" "}
          <Link href={ownerVerificationHref("status")} className="text-link">
            Xem trạng thái hồ sơ
          </Link>
        </Alert>
      )}
      {restaurant.verificationStatus === "rejected" && (
        <Alert tone="warning">
          Hồ sơ xác minh chưa được chấp thuận.{" "}
          <Link href={ownerVerificationHref("status")} className="text-link">
            Xem phản hồi và gửi lại hồ sơ
          </Link>
        </Alert>
      )}
      {restaurant.verificationStatus === "verified" && (
        <Alert tone="success">Nhà hàng đã được xác minh.</Alert>
      )}
      {restaurant.moderationStatus !== "visible" && (
        <Alert tone="warning">
          Nhà hàng đang{" "}
          {restaurant.moderationStatus === "hidden" ? "bị ẩn" : "bị đình chỉ"}{" "}
          bởi kiểm duyệt viên nên khách chưa nhìn thấy.
        </Alert>
      )}
      {menu && (
        <Alert tone="info">
          Bạn có một bản thực đơn ở trạng thái {menuStatusLabels[menu.status]}.
          Thực đơn đang bán vẫn phục vụ khách trong khi bạn chỉnh sửa.{" "}
          <Link href={ownerRoutes.menu} className="text-link">
            Mở thực đơn
          </Link>
        </Alert>
      )}
    </div>
  );
}

function QuickLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="quick-link">
      <strong>{title}</strong>
      <span>{text}</span>
      <span className="quick-link-arrow" aria-hidden>
        ↗
      </span>
    </Link>
  );
}
