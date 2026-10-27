"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Avatar,
  Choice,
  EmptyState,
  Media,
  Pagination,
  SelectField,
  Skeleton,
  Tabs,
} from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { DishCard } from "./explore-cards";
import {
  businessHoursByDay,
  googleMapsPlaceHref,
  locationText,
  operatingBadge,
  priceLevelText,
  ratingShares,
  ratingSummary,
  ratingText,
  reviewDate,
  reviewPageSize,
  reportError,
  reportReasons,
  reviewSortOptions,
  visibleReply,
} from "./explore-rules";
import { exploreRoutes } from "./explore-routes";
import { exploreService, type ExploreService } from "./explore-service";
import type {
  RestaurantDetailDto,
  ReviewDto,
  ReviewSort,
} from "./explore-types";
import { ReportDialog } from "@/components/domain/report-dialog";
import { ReviewDialog } from "./review-dialog";
import { useRemote } from "./use-remote";
import "./explore.css";

/** Who is looking: only a Traveler can review or report (REV-01, REP-01). */
export type Viewer = "TRAVELER" | "GUEST" | "OTHER";

function Stars({ value }: { value: number }) {
  return (
    <span
      className="explore-stars-static"
      role="img"
      aria-label={`${value} trên 5 sao`}
    >
      {"★★★★★".slice(0, value)}
      <span className="off">{"★★★★★".slice(value)}</span>
    </span>
  );
}

function ReviewItem({ review }: { review: ReviewDto }) {
  const reply = visibleReply(review);
  return (
    <article className="explore-review">
      <header>
        <Avatar name={review.user.displayName} image={review.user.avatarUrl} />
        <div>
          <strong>{review.user.displayName}</strong>
          <p className="helper">{reviewDate(review.createdAt)}</p>
        </div>
        <Stars value={review.rating} />
      </header>
      {review.content && <p>{review.content}</p>}
      {review.images.length > 0 && (
        <ul className="explore-review-images" aria-label="Ảnh trong đánh giá">
          {review.images.map((url) => (
            <li key={url}>
              <Media src={url} alt={`Ảnh của ${review.user.displayName}`} />
            </li>
          ))}
        </ul>
      )}
      {reply && (
        <div className="explore-reply">
          <p className="eyebrow">Phản hồi từ quán</p>
          <p>{reply.content}</p>
        </div>
      )}
    </article>
  );
}

function ReviewsTab({
  restaurantId,
  service,
  version,
}: {
  restaurantId: number;
  service: ExploreService;
  version: number;
}) {
  const [rating, setRating] = useState("");
  const [hasImage, setHasImage] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [page, setPage] = useState(1);
  const [state, retry] = useRemote(
    () =>
      service.reviews(restaurantId, {
        rating: rating ? Number(rating) : undefined,
        hasImage: hasImage || undefined,
        sort,
        page,
        pageSize: reviewPageSize,
      }),
    `${restaurantId}:${rating}:${hasImage}:${sort}:${page}:${version}`,
  );
  const filters = (
    <div className="explore-review-filters">
      <SelectField
        label="Sắp xếp"
        value={sort}
        options={reviewSortOptions}
        onChange={(value) => {
          setSort(value as ReviewSort);
          setPage(1);
        }}
      />
      <Choice
        label="Chỉ đánh giá có ảnh"
        checked={hasImage}
        onChange={(checked) => {
          setHasImage(checked);
          setPage(1);
        }}
      />
    </div>
  );
  if (state.status === "loading") return <Skeleton rows={3} />;
  if (state.status === "error")
    return (
      <Card title="Chưa tải được đánh giá">
        <Alert>{getErrorMessage(state.error)}</Alert>
        <Button onClick={retry}>Thử lại</Button>
      </Card>
    );
  const { data } = state;
  const shares = ratingShares(data.ratingBreakdown);
  return (
    <div className="stack">
      <Card>
        <div className="explore-rating-summary">
          <div>
            <p className="explore-rating-big">
              {data.ratingCount ? ratingText(data.ratingAvg) : "—"}
            </p>
            <p className="helper">
              {data.ratingCount
                ? `${data.ratingCount} đánh giá`
                : "Chưa có đánh giá"}
            </p>
          </div>
          <ul className="explore-breakdown" aria-label="Phân bố số sao">
            {shares.map((row) => (
              <li key={row.star}>
                <button
                  type="button"
                  aria-pressed={rating === String(row.star)}
                  className={`explore-breakdown-row ${rating === String(row.star) ? "selected" : ""}`}
                  aria-label={`Lọc ${row.star} sao: ${row.count} đánh giá`}
                  onClick={() => {
                    setRating(
                      rating === String(row.star) ? "" : String(row.star),
                    );
                    setPage(1);
                  }}
                  suppressHydrationWarning
                >
                  <span>{row.star} ★</span>
                  <span className="explore-bar" aria-hidden>
                    <span
                      style={{ width: `${Math.round(row.share * 100)}%` }}
                    />
                  </span>
                  <span>{row.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      {filters}
      {data.items.length === 0 ? (
        <EmptyState title="Chưa có đánh giá phù hợp">
          {rating || hasImage
            ? "Thử bỏ bớt bộ lọc để xem thêm đánh giá."
            : "Hãy là người đầu tiên đánh giá quán này."}
        </EmptyState>
      ) : (
        <div className="stack-sm">
          {data.items.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </div>
      )}
      {data.totalPages > 1 && (
        <Pagination
          total={data.totalItems}
          page={data.page}
          size={data.pageSize}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function MenuTab({
  restaurantId,
  service,
}: {
  restaurantId: number;
  service: ExploreService;
}) {
  const [state, retry] = useRemote(
    () => service.menu(restaurantId),
    String(restaurantId),
  );
  if (state.status === "loading") return <Skeleton rows={3} />;
  if (state.status === "error")
    return (
      <Card title="Chưa tải được thực đơn">
        <Alert>{getErrorMessage(state.error)}</Alert>
        <Button onClick={retry}>Thử lại</Button>
      </Card>
    );
  if (!state.data.dishes.length)
    return (
      <EmptyState title="Quán chưa có món nào">
        Thực đơn sẽ hiện ở đây khi quán được duyệt món.
      </EmptyState>
    );
  return (
    <ul className="explore-grid">
      {state.data.dishes.map((dish) => (
        <li key={dish.id}>
          <DishCard dish={dish} showRestaurant={false} />
        </li>
      ))}
    </ul>
  );
}

function InfoTab({ restaurant }: { restaurant: RestaurantDetailDto }) {
  const days = businessHoursByDay(restaurant.businessHours);
  const place = locationText(restaurant.district, restaurant.provinceName);
  return (
    <div className="explore-info">
      <Card title="Giờ mở cửa">
        <dl className="detail-list">
          {days.map((day) => (
            <div key={day.day}>
              <dt>{day.label}</dt>
              <dd className={day.open ? "" : "muted"}>{day.text}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Liên hệ">
        <dl className="detail-list">
          <div>
            <dt>Địa chỉ</dt>
            <dd>
              {[restaurant.addressLine, restaurant.ward, place]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
          {restaurant.phone && (
            <div>
              <dt>Điện thoại</dt>
              <dd>
                <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`}>
                  {restaurant.phone}
                </a>
              </dd>
            </div>
          )}
          {restaurant.email && (
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${restaurant.email}`}>{restaurant.email}</a>
              </dd>
            </div>
          )}
          {restaurant.website && (
            <div>
              <dt>Website</dt>
              <dd>
                <a href={restaurant.website} target="_blank" rel="noreferrer">
                  {restaurant.website}
                </a>
              </dd>
            </div>
          )}
        </dl>
        <Alert tone="info">
          Kiểm tra giá, giờ mở cửa và thành phần với quán trước khi đi.
        </Alert>
      </Card>
    </div>
  );
}

/** F-16 View Restaurant Detail: REST-02, REST-03, REST-04, with REV-01 and REP-01 for a Traveler. */
export function RestaurantDetailPage({
  restaurantId,
  viewer,
  service = exploreService,
}: {
  restaurantId: number;
  viewer: Viewer;
  service?: ExploreService;
}) {
  const [reload, setReload] = useState(0);
  const [state, retry] = useRemote(
    () => service.restaurant(restaurantId),
    `${restaurantId}:${reload}`,
  );
  const [tab, setTab] = useState("menu");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "info";
    text: string;
  } | null>(null);

  if (state.status === "loading") return <Skeleton rows={5} />;
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      (state.error.errorCode === "RESTAURANT_NOT_FOUND" ||
        state.error.status === 404);
    return (
      <Card title={missing ? "Không tìm thấy quán" : "Chưa tải được quán"}>
        {missing ? (
          <p>Quán này không tồn tại hoặc hiện không được hiển thị.</p>
        ) : (
          <Alert>{getErrorMessage(state.error)}</Alert>
        )}
        <div className="actions">
          {!missing && <Button onClick={retry}>Thử lại</Button>}
          <ActionLink href={exploreRoutes.restaurants} secondary>
            Về danh sách quán
          </ActionLink>
        </div>
      </Card>
    );
  }
  const restaurant = state.data;
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  const price = priceLevelText(restaurant.priceLevel);
  const place = locationText(restaurant.district, restaurant.provinceName);
  const map = googleMapsPlaceHref(restaurant.latitude, restaurant.longitude);
  const mine = restaurant.myReview ?? null;
  const pictures = [
    ...(restaurant.coverUrl ? [restaurant.coverUrl] : []),
    ...restaurant.images.filter((url) => url !== restaurant.coverUrl),
  ];
  return (
    <div className="stack">
      <nav className="explore-back" aria-label="Quay lại">
        <Link href={exploreRoutes.restaurants}>← Tất cả quán ăn</Link>
      </nav>
      <div className="explore-hero">
        <div className="explore-gallery">
          <Media src={pictures[0]} alt={restaurant.name} />
          {pictures.length > 1 && (
            <ul className="explore-thumbs" aria-label="Ảnh của quán">
              {pictures.slice(1, 5).map((url, index) => (
                <li key={url}>
                  <Media src={url} alt={`${restaurant.name} ${index + 2}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="stack-sm">
          <p className="eyebrow">Quán ăn</p>
          <h1>{restaurant.name}</h1>
          <p className="helper">
            {restaurant.addressLine}
            {place && ` · ${place}`}
          </p>
          <p className="explore-chips">
            <Badge tone={status.tone}>{status.text}</Badge>
            <span>
              {ratingSummary(restaurant.ratingAvg, restaurant.ratingCount)}
            </span>
            {price && <span>Giá {price}</span>}
          </p>
          {restaurant.description && <p>{restaurant.description}</p>}
          <div className="actions">
            {map && (
              <a
                className="button button-secondary"
                href={map}
                target="_blank"
                rel="noreferrer"
              >
                Chỉ đường trên Google Maps
              </a>
            )}
            {viewer === "TRAVELER" &&
              (mine ? (
                <Badge tone="success">Bạn đã đánh giá quán này</Badge>
              ) : (
                <Button onClick={() => setReviewOpen(true)}>
                  Viết đánh giá
                </Button>
              ))}
            {viewer === "TRAVELER" && (
              <Button variant="secondary" onClick={() => setReportOpen(true)}>
                Báo cáo quán
              </Button>
            )}
            {viewer === "GUEST" && (
              <ActionLink href="/login">Đăng nhập để đánh giá</ActionLink>
            )}
          </div>
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        </div>
      </div>
      <Tabs
        label="Thông tin quán"
        value={tab}
        onChange={setTab}
        items={[
          { value: "menu", label: "Thực đơn" },
          { value: "reviews", label: "Đánh giá" },
          { value: "information", label: "Thông tin" },
        ]}
      />
      {tab === "menu" && (
        <MenuTab restaurantId={restaurantId} service={service} />
      )}
      {tab === "reviews" && (
        <ReviewsTab
          restaurantId={restaurantId}
          service={service}
          version={reload}
        />
      )}
      {tab === "information" && <InfoTab restaurant={restaurant} />}
      {reviewOpen && (
        <ReviewDialog
          open
          restaurantId={restaurantId}
          restaurantName={restaurant.name}
          service={service}
          onClose={() => setReviewOpen(false)}
          onSaved={(saved) => {
            setReviewOpen(false);
            setReload((value) => value + 1);
            setTab("reviews");
            setNotice(
              saved
                ? {
                    tone: "success",
                    text: "Đã gửi đánh giá của bạn. Cảm ơn bạn!",
                  }
                : {
                    tone: "info",
                    text: "Bạn đã đánh giá quán này trước đó, nên không đánh giá lại được.",
                  },
            );
          }}
        />
      )}
      {reportOpen && (
        <ReportDialog
          open
          title={`Báo cáo ${restaurant.name}`}
          reasons={reportReasons}
          send={(request) => service.reportRestaurant(restaurantId, request)}
          upload={(file) => service.upload(file, "report_evidence")}
          errorOf={reportError}
          onClose={() => setReportOpen(false)}
          onSent={(already) => {
            setReportOpen(false);
            setNotice(
              already
                ? {
                    tone: "info",
                    text: "Báo cáo trước đó của bạn về quán này đang chờ xử lý.",
                  }
                : {
                    tone: "success",
                    text: "Đã gửi báo cáo. Đội kiểm duyệt sẽ xem xét sớm.",
                  },
            );
          }}
        />
      )}
    </div>
  );
}
