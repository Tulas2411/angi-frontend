"use client";
import { notify } from "@/shared/ui/notify";
import { useState, type ReactNode } from "react";
import {
  BuildingStorefrontIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Avatar,
  EmptyState,
  Media,
  Pagination,
  SelectField,
  Skeleton,
  Tabs,
} from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { useDishView } from "./dish-view-mode";
import {
  DishDetailCard,
  DishRow,
  DishTile,
  DishViewSwitcher,
} from "./dish-views";
import { useDishDescriptions } from "./use-dish-descriptions";
import { MenuWheel } from "./menu-wheel";
import {
  businessHoursByDay,
  googleMapsPlaceHref,
  locationText,
  operatingBadge,
  priceLevelText,
  ratingShares,
  satisfiedShare,
  ratingSummary,
  reviewDate,
  reviewPageSize,
  reportError,
  reportReasons,
  reviewSortOptions,
  todayOpening,
  vietnamWeekday,
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
      <Avatar name={review.user.displayName} image={review.user.avatarUrl} />
      <div className="explore-review-body">
        <header>
          <strong>{review.user.displayName}</strong>
          <p className="explore-review-meta">
            <Stars value={review.rating} />
            <span aria-hidden>·</span>
            <span>{reviewDate(review.createdAt)}</span>
          </p>
        </header>
        {review.content && (
          <p className="explore-review-text">{review.content}</p>
        )}
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
            <p className="explore-reply-title">
              <BuildingStorefrontIcon aria-hidden />
              Phản hồi từ quán
            </p>
            <p>{reply.content}</p>
          </div>
        )}
      </div>
    </article>
  );
}

/** "4,6", "5,0": the average always with one decimal, as rating sites show it. */
const averageText = (average: number) =>
  new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);

/**
 * REST-04 in one card: the score and how the stars spread (a row filters by its star), a toolbar
 * (count, the star filter in use, "Có ảnh", order), then the reviews divided by rules.
 */
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
  const satisfied = satisfiedShare(data.ratingBreakdown);
  const rated = data.ratingCount > 0;
  return (
    <section className="explore-reviews" aria-label="Đánh giá của thực khách">
      <div className="explore-rating-summary">
        <div className="explore-rating-score">
          <p className="explore-rating-big">
            {rated ? averageText(data.ratingAvg) : "—"}
          </p>
          {rated && <Stars value={Math.round(data.ratingAvg)} />}
          <p className="helper">
            {rated ? `${data.ratingCount} đánh giá` : "Chưa có đánh giá"}
          </p>
          {satisfied !== null && (
            <p className="explore-rating-satisfied">
              <strong>{satisfied}%</strong> thực khách chấm 4–5 sao
            </p>
          )}
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
                <span className="explore-breakdown-star">
                  {row.star}
                  <StarIcon aria-hidden />
                </span>
                <span className="explore-bar" aria-hidden>
                  <span style={{ width: `${Math.round(row.share * 100)}%` }} />
                </span>
                <span className="explore-breakdown-count">{row.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="explore-review-toolbar">
        <p className="explore-review-count" role="status">
          {data.totalItems} đánh giá
          {rating && (
            <button
              type="button"
              className="explore-review-filter-chip"
              onClick={() => {
                setRating("");
                setPage(1);
              }}
            >
              Chỉ {rating} sao
              <XMarkIcon aria-hidden />
              <span className="sr-only">, bỏ lọc</span>
            </button>
          )}
        </p>
        <div className="explore-review-filters">
          <label className="explore-review-photo-chip">
            <input
              type="checkbox"
              aria-label="Chỉ đánh giá có ảnh"
              checked={hasImage}
              onChange={(event) => {
                setHasImage(event.target.checked);
                setPage(1);
              }}
              suppressHydrationWarning
            />
            <span>
              <PhotoIcon aria-hidden />
              Có ảnh
            </span>
          </label>
          <SelectField
            label="Sắp xếp"
            value={sort}
            options={reviewSortOptions}
            onChange={(value) => {
              setSort(value as ReviewSort);
              setPage(1);
            }}
          />
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState title="Chưa có đánh giá phù hợp">
          {rating || hasImage
            ? "Thử bỏ bớt bộ lọc để xem thêm đánh giá."
            : "Hãy là người đầu tiên đánh giá quán này."}
        </EmptyState>
      ) : (
        <div className="explore-review-list">
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
    </section>
  );
}

function MenuTab({
  restaurantId,
  restaurantName,
  service,
}: {
  restaurantId: number;
  restaurantName: string;
  service: ExploreService;
}) {
  const [state, retry] = useRemote(
    () => service.menu(restaurantId),
    String(restaurantId),
  );
  // The same three layouts as the dish list, with the layout chosen there.
  const [view, setView] = useDishView();
  const dishes = state.status === "ready" ? state.data.dishes : [];
  const { describe, retry: retryDescription } = useDishDescriptions(
    service,
    dishes.map((dish) => dish.id),
    // The wheel shows the description of the dish on its plate, whatever the layout below.
    true,
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
  // Menu dishes carry no restaurant: the page is the restaurant, so it is not named again.
  const items = dishes.map((dish) => ({ ...dish, restaurant: undefined }));
  return (
    <>
      <MenuWheel
        restaurantName={restaurantName}
        dishes={dishes}
        describe={describe}
      />
      <section className="dish-results" aria-label="Thực đơn của quán">
        <div className="dish-results-bar">
          <p className="helper" role="status">
            {items.length} món trong thực đơn
          </p>
          <DishViewSwitcher view={view} onChange={setView} />
        </div>
        <ul className={`dish-items dish-items-${view}`}>
          {items.map((dish) => (
            <li key={dish.id}>
              {view === "gallery" ? (
                <DishTile dish={dish} />
              ) : view === "list" ? (
                <DishRow
                  dish={dish}
                  description={describe(dish.id)}
                  onRetry={() => retryDescription(dish.id)}
                />
              ) : (
                <DishDetailCard
                  dish={dish}
                  description={describe(dish.id)}
                  onRetry={() => retryDescription(dish.id)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** The restaurant's name at the top of the menu and review tabs, where the hero is not shown. */
/**
 * The name above the menu and review tabs, with today's state right beside it. The score chip
 * is left out on "Đánh giá", whose summary already shows it.
 */
function TabTitle({
  restaurant,
  actions,
  showRating = true,
}: {
  restaurant: RestaurantDetailDto;
  actions?: ReactNode;
  showRating?: boolean;
}) {
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  return (
    <div className="explore-tab-title">
      <div className="explore-tab-name">
        <h1>{restaurant.name}</h1>
        <p className="explore-chips">
          <Badge tone={status.tone}>{status.text}</Badge>
          {showRating && (
            <span>
              {ratingSummary(restaurant.ratingAvg, restaurant.ratingCount)}
            </span>
          )}
        </p>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/**
 * "Thông tin": the general part (photos, name, rating, description, actions) first, then where
 * to find the restaurant and when it is open, today's hours marked.
 */
function InfoTab({
  restaurant,
  hero,
}: {
  restaurant: RestaurantDetailDto;
  hero: ReactNode;
}) {
  const days = businessHoursByDay(restaurant.businessHours);
  const today = vietnamWeekday();
  const todayHours = days.find((day) => day.day === today);
  const opening = todayOpening(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
    Boolean(todayHours?.open),
  );
  const map = googleMapsPlaceHref(restaurant.latitude, restaurant.longitude);
  return (
    <div className="stack">
      {hero}
      <div className="explore-info">
        <Card title="Liên hệ & vị trí">
          <dl className="detail-list">
            <div>
              <dt>Địa chỉ</dt>
              <dd>
                {restaurant.addressLine}
                {map && (
                  <>
                    <br />
                    <a href={map} target="_blank" rel="noreferrer">
                      Chỉ đường trên Google Maps
                    </a>
                  </>
                )}
              </dd>
            </div>
            {restaurant.ward && (
              <div>
                <dt>Phường / xã</dt>
                <dd>{restaurant.ward}</dd>
              </div>
            )}
            {restaurant.provinceName && (
              <div>
                <dt>Tỉnh / thành phố</dt>
                <dd>{restaurant.provinceName}</dd>
              </div>
            )}
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
        <Card title="Giờ mở cửa">
          <p className="explore-today" data-tone={opening.tone}>
            <span className="explore-today-state">
              <span aria-hidden /> {opening.text}
            </span>
            <span>
              Hôm nay ({todayHours?.label.toLowerCase()}):{" "}
              <strong>{todayHours?.text ?? "Chưa có giờ mở cửa"}</strong>
            </span>
          </p>
          <dl className="detail-list explore-hours">
            {days.map((day) => (
              <div
                key={day.day}
                data-today={day.day === today || undefined}
                data-tone={day.day === today ? opening.tone : undefined}
              >
                <dt>{day.label}</dt>
                <dd className={day.open ? "" : "muted"}>{day.text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
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
  // The general information opens first; it holds the photos, the name and the actions.
  // The menu opens first (owner request 2026-11-07): people come to a restaurant for its dishes.
  const [tab, setTab] = useState("menu");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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
  // Writing a review: in the general information and again on the review tab.
  const reviewAction =
    viewer === "TRAVELER" ? (
      mine ? (
        <Badge tone="success">Bạn đã đánh giá quán này</Badge>
      ) : (
        <Button onClick={() => setReviewOpen(true)}>Viết đánh giá</Button>
      )
    ) : viewer === "GUEST" ? (
      <ActionLink href="/login">Đăng nhập để đánh giá</ActionLink>
    ) : null;
  const hero = (
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
          {reviewAction}
          {viewer === "TRAVELER" && (
            <Button variant="secondary" onClick={() => setReportOpen(true)}>
              Báo cáo quán
            </Button>
          )}
        </div>
      </div>
    </div>
  );
  return (
    <div className="stack">
      <nav className="explore-back" aria-label="Quay lại">
        <Link href={exploreRoutes.restaurants}>← Tất cả quán ăn</Link>
      </nav>
      <Tabs
        label="Thông tin quán"
        value={tab}
        onChange={setTab}
        items={[
          { value: "information", label: "Thông tin" },
          { value: "menu", label: "Thực đơn" },
          { value: "reviews", label: "Đánh giá" },
        ]}
      />
      {tab === "information" && <InfoTab restaurant={restaurant} hero={hero} />}
      {tab === "menu" && (
        <>
          <TabTitle restaurant={restaurant} />
          <MenuTab
            restaurantId={restaurantId}
            restaurantName={restaurant.name}
            service={service}
          />
        </>
      )}
      {tab === "reviews" && (
        <>
          <TabTitle
            restaurant={restaurant}
            actions={reviewAction}
            showRating={false}
          />
          <ReviewsTab
            restaurantId={restaurantId}
            service={service}
            version={reload}
          />
        </>
      )}
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
            if (saved) notify.success("Đã gửi đánh giá của bạn. Cảm ơn bạn!");
            else
              notify.info(
                "Bạn đã đánh giá quán này trước đó, nên không đánh giá lại được.",
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
            if (already)
              notify.info("Báo cáo trước đó của bạn về quán này đang chờ xử lý.");
            else
              notify.success("Đã gửi báo cáo. Đội kiểm duyệt sẽ xem xét sớm.");
          }}
        />
      )}
    </div>
  );
}
