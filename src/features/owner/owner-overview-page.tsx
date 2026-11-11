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
import { RestaurantStatusBadges } from "./status-labels";

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
        <ProfileCover restaurant={restaurant} />
        <div className="overview-profile-main">
          <RestaurantGallery restaurant={restaurant} />
          <div className="overview-profile-body">
            <div className="overview-profile-intro">
              <RestaurantStatusBadges restaurant={restaurant} />
              {restaurant.description ? (
                <p
                  className="overview-profile-description"
                  title={restaurant.description}
                >
                  {restaurant.description}
                </p>
              ) : (
                <p className="helper">
                  Chưa có mô tả. Thêm vài dòng giới thiệu món đặc trưng và không
                  gian quán trong Quản lý hồ sơ.
                </p>
              )}
            </div>
            <dl className="overview-profile-details">
              <div>
                <dt>Địa chỉ</dt>
                <dd>
                  {[restaurant.addressLine, location]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
              {restaurant.phone && (
                <div>
                  <dt>Điện thoại</dt>
                  <dd>
                    <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>
                  </dd>
                </div>
              )}
              {restaurant.email && (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${restaurant.email}`}>
                      {restaurant.email}
                    </a>
                  </dd>
                </div>
              )}
              {restaurant.website && (
                <div>
                  <dt>Website</dt>
                  <dd>
                    <a
                      href={restaurant.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {restaurant.website.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <div className="actions">
              <ActionLink href={ownerProfileHref()} secondary>
                Quản lý hồ sơ
              </ActionLink>
            </div>
          </div>
        </div>
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

/** Wide banner across the top of the card, like a profile cover on a social page. */
function ProfileCover({ restaurant }: { restaurant: OwnerRestaurantDto }) {
  return (
    <div className="overview-cover">
      {restaurant.coverUrl ? (
        <Media src={restaurant.coverUrl} alt={`Ảnh bìa ${restaurant.name}`} />
      ) : (
        <div className="overview-cover-empty">
          <span>Chưa có ảnh bìa</span>
        </div>
      )}
      <Link href={ownerProfileHref("photos")} className="overview-cover-action">
        {restaurant.coverUrl ? "Đổi ảnh bìa" : "Thêm ảnh bìa"}
      </Link>
    </div>
  );
}

/** Gallery photos (`images`, in the owner's order): one large view and thumbnails to switch it. */
function RestaurantGallery({ restaurant }: { restaurant: OwnerRestaurantDto }) {
  const images = restaurant.images.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const active = Math.min(selected, images.length - 1);
  const current = images[active];
  return (
    <section className="overview-gallery" aria-label="Ảnh nhà hàng">
      {current ? (
        <>
          <Media src={current} alt={`${restaurant.name} – ảnh ${active + 1}`} />
          {images.length > 1 && (
            <ul className="overview-gallery-thumbs">
              {images.map((url, index) => (
                <li key={`${url}-${index}`}>
                  <button
                    type="button"
                    aria-label={`Xem ảnh ${index + 1}`}
                    aria-pressed={index === active}
                    onClick={() => setSelected(index)}
                  >
                    <Media src={url} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="overview-gallery-empty">
          <span aria-hidden>▧</span>
          <p>
            Chưa có ảnh nhà hàng. Thêm ảnh món ăn và không gian quán để khách dễ
            hình dung.
          </p>
        </div>
      )}
      <div className="overview-gallery-head">
        <h2>
          Ảnh nhà hàng{images.length > 0 && <span> · {images.length}</span>}
        </h2>
        <Link href={ownerProfileHref("photos")} className="text-link">
          {images.length ? "Quản lý ảnh" : "Thêm ảnh"}
        </Link>
      </div>
    </section>
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
