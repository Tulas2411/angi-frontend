"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ClockIcon,
  GlobeAltIcon,
  MapPinIcon,
  NoSymbolIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/solid";
import { Button } from "@/shared/ui";
import { Avatar, Icon, Media, Tabs } from "@/components/ui/primitives";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { getErrorMessage } from "@/shared/api/error";
import {
  businessHoursByDay,
  dishFormLabels,
  googleMapsPlaceHref,
  operatingBadge,
  ratingShares,
  ratingText,
  reviewDate,
  visibleReply,
} from "@/features/explore/explore-rules";
import { dishHref, restaurantHref } from "@/features/explore/explore-routes";
import {
  exploreService,
  type ExploreService,
} from "@/features/explore/explore-service";
import type {
  DishDetailDto,
  RestaurantDetailDto,
  ReviewDto,
  ReviewSort,
} from "@/features/explore/explore-types";
import { useRemote, type Remote } from "@/features/explore/use-remote";
import { mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import type { RoadmapMapStop } from "./roadmap-map-rules";
import { FadingText } from "./fading-text";
import "./roadmap-place.css";

/** What the place card reads: DISH-02, REST-02 and REST-04 (public reads, the session token is sent). */
export type PlaceService = Pick<
  ExploreService,
  "dish" | "restaurant" | "reviews"
>;

const placeTabs = [
  { value: "dish", label: "Món ăn" },
  { value: "restaurant", label: "Quán hàng" },
  { value: "reviews", label: "Đánh giá" },
  { value: "photos", label: "Ảnh" },
] as const;
type PlaceTab = (typeof placeTabs)[number]["value"];

/** REST-04 page size inside the card; "Xem thêm đánh giá" asks for the next page. */
const cardReviewPageSize = 5;

const reviewSortChips: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "rating_desc", label: "Cao nhất" },
  { value: "rating_asc", label: "Thấp nhất" },
];

/** Heroicons (outline, 24px) in the rows of the card. */
const icon = { className: "roadmap-place-icon", "aria-hidden": true } as const;

/** 0 = Sunday … 6 = Saturday, today in Vietnam (BusinessHour.dayOfWeek). */
function vietnamWeekday(now = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
  }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function Stars({ value, label }: { value: number; label?: string }) {
  const whole = Math.round(value);
  return (
    <span
      className="roadmap-place-stars"
      role="img"
      aria-label={label ?? `${ratingText(value)} trên 5 sao`}
    >
      {"★★★★★".slice(0, whole)}
      <span>{"★★★★★".slice(whole)}</span>
    </span>
  );
}

/** A long text kept to four lines until the traveler asks for the rest. */
function LongText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <div className="roadmap-place-text">
      <p data-clamped={long && !open}>{text}</p>
      {long && (
        <button
          type="button"
          className="roadmap-place-more"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}

function LoadFailed({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="roadmap-place-failed" role="alert">
      <p>
        <strong>{title}</strong> {getErrorMessage(error)}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

function Loading() {
  return (
    <div className="roadmap-place-loading" role="status">
      <span />
      <span />
      <span />
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}

/** A photo list without repeats, the cover first. */
function photosOf(cover: string | null | undefined, images: readonly string[]) {
  return [
    ...new Set([cover, ...images].filter((url): url is string => Boolean(url))),
  ];
}

/**
 * The dish description, then one line per fact
 * with its icon. DISH-02 adds to what RM-03 already knows, which is shown at once.
 */
function DishPanel({
  stop,
  state,
  onRetry,
}: {
  stop: RoadmapMapStop;
  state: Remote<DishDetailDto>;
  onRetry: () => void;
}) {
  const { dish } = stop.item;
  const detail = state.status === "ready" ? state.data : null;
  const tags = detail?.tags ?? dish.tags;
  const likes = detail?.likeCount ?? dish.likeCount;
  const available = detail?.isAvailable ?? dish.isAvailable;
  const place = [dish.restaurant.district, dish.restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="roadmap-place-panel">
      {/* No dish photo here (removed 2026-11-04): the itinerary card and the "Ảnh" tab show it. */}
      <div className="roadmap-place-intro">
        {state.status === "loading" && <Loading />}
        {state.status === "error" && (
          <LoadFailed
            title="Chưa tải được mô tả món."
            error={state.error}
            onRetry={onRetry}
          />
        )}
        {detail &&
          (detail.description ? (
            <LongText text={detail.description} />
          ) : (
            <p className="helper">Quán chưa viết mô tả cho món này.</p>
          ))}
      </div>
      {tags.length > 0 && (
        <ul className="roadmap-place-tags" aria-label="Thẻ của món">
          {tags.map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
      )}
      <ul className="roadmap-place-rows">
        <li>
          <BanknotesIcon {...icon} />
          {/* Price and dish form on one line: "60.000 VND · Món nước". */}
          <span className="roadmap-place-price">
            <strong>{vnd(detail?.price ?? dish.price)}</strong>
            <span>· {dishFormLabels[detail?.dishForm ?? dish.dishForm]}</span>
          </span>
        </li>
        <li>
          <HeartIcon {...icon} className="roadmap-place-icon is-like" />
          <span>{likes.toLocaleString("vi-VN")} lượt thích</span>
        </li>
        <li data-tone={available ? "success" : "warning"}>
          {available ? (
            <CheckCircleIcon {...icon} />
          ) : (
            <NoSymbolIcon {...icon} />
          )}
          <span>{available ? "Đang bán" : "Tạm hết món"}</span>
        </li>
        <li>
          <BuildingStorefrontIcon {...icon} />
          <span>
            {dish.restaurant.name}
            {place && ` · ${place}`}
          </span>
        </li>
      </ul>
      <Link
        className="roadmap-place-link"
        href={dishHref(dish.id)}
        prefetch={false}
      >
        Xem trang món ăn →
      </Link>
    </div>
  );
}

/** REST-02: rating, status, address, hours, contact and photos of the restaurant. */
function RestaurantPanel({
  state,
  onRetry,
}: {
  state: Remote<RestaurantDetailDto>;
  onRetry: () => void;
}) {
  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <LoadFailed
        title="Chưa tải được thông tin quán."
        error={state.error}
        onRetry={onRetry}
      />
    );
  const restaurant = state.data;
  // The open/closed badge sits beside the restaurant's name in the card head, and the star score
  // row is gone (both changed 2026-11-04): the "Đánh giá" tab holds the ratings.
  const address = [
    restaurant.addressLine,
    restaurant.ward,
    restaurant.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
  const directions = googleMapsPlaceHref(
    restaurant.latitude,
    restaurant.longitude,
  );
  const week = businessHoursByDay(restaurant.businessHours);
  const today = week.find((day) => day.day === vietnamWeekday());
  return (
    <div className="roadmap-place-panel">
      <ul className="roadmap-place-rows">
        <li>
          <MapPinIcon {...icon} />
          <span>
            {address}
            {directions && (
              <a href={directions} target="_blank" rel="noreferrer">
                Chỉ đường trên Google Maps
              </a>
            )}
          </span>
        </li>
        <li>
          <ClockIcon {...icon} />
          <details>
            <summary>
              Hôm nay: <strong>{today?.text ?? "Chưa có giờ mở cửa"}</strong>
            </summary>
            <dl>
              {week.map((day) => (
                <div key={day.day} data-today={day.day === today?.day}>
                  <dt>{day.label}</dt>
                  <dd>{day.text}</dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
        {restaurant.phone && (
          <li>
            <PhoneIcon {...icon} />
            <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`}>
              {restaurant.phone}
            </a>
          </li>
        )}
        {restaurant.website && (
          <li>
            <GlobeAltIcon {...icon} />
            <a href={restaurant.website} target="_blank" rel="noreferrer">
              {restaurant.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
      {restaurant.description && <LongText text={restaurant.description} />}
      <Link
        className="roadmap-place-link"
        href={restaurantHref(restaurant.id)}
        prefetch={false}
      >
        Xem trang quán →
      </Link>
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewDto }) {
  const reply = visibleReply(review);
  return (
    <article className="roadmap-place-review">
      <header>
        <Avatar name={review.user.displayName} image={review.user.avatarUrl} />
        <div>
          <strong>{review.user.displayName}</strong>
          <p>
            <Stars
              value={review.rating}
              label={`${review.rating} trên 5 sao`}
            />{" "}
            · {reviewDate(review.createdAt)}
          </p>
        </div>
      </header>
      {review.content && <LongText text={review.content} />}
      {review.images.length > 0 && (
        <ul
          className="roadmap-place-review-images"
          aria-label="Ảnh trong đánh giá"
        >
          {review.images.map((url) => (
            <li key={url}>
              <Media src={url} alt={`Ảnh của ${review.user.displayName}`} />
            </li>
          ))}
        </ul>
      )}
      {reply && (
        <div className="roadmap-place-reply">
          <strong>Phản hồi từ quán</strong>
          <p>{reply.content}</p>
        </div>
      )}
    </article>
  );
}

interface ReviewFilters {
  rating: number | null;
  hasImage: boolean;
  sort: ReviewSort;
}

/**
 * One REST-04 page. The first page also draws the summary (Google Maps style: the average on the
 * left, the star bars on the right; a bar filters the list). The last loaded page offers the next.
 */
function ReviewPage({
  restaurantId,
  service,
  filters,
  page,
  last,
  onFilters,
  onMore,
}: {
  restaurantId: number;
  service: PlaceService;
  filters: ReviewFilters;
  page: number;
  last: boolean;
  onFilters: (next: ReviewFilters) => void;
  onMore: () => void;
}) {
  const [state, retry] = useRemote(
    () =>
      service.reviews(restaurantId, {
        rating: filters.rating ?? undefined,
        hasImage: filters.hasImage || undefined,
        sort: filters.sort,
        page,
        pageSize: cardReviewPageSize,
      }),
    `${restaurantId}:${filters.rating}:${filters.hasImage}:${filters.sort}:${page}`,
  );
  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <LoadFailed
        title="Chưa tải được đánh giá."
        error={state.error}
        onRetry={retry}
      />
    );
  const { data } = state;
  const filtered = filters.rating !== null || filters.hasImage;
  return (
    <>
      {page === 1 && (
        <>
          <div className="roadmap-place-summary">
            <div>
              <p className="roadmap-place-average">
                {data.ratingCount ? ratingText(data.ratingAvg) : "—"}
              </p>
              <Stars value={data.ratingCount ? data.ratingAvg : 0} />
              <p className="helper">
                {data.ratingCount
                  ? `${data.ratingCount} đánh giá`
                  : "Chưa có đánh giá"}
              </p>
            </div>
            <ul aria-label="Phân bố số sao">
              {ratingShares(data.ratingBreakdown).map((row) => (
                <li key={row.star}>
                  <button
                    type="button"
                    aria-pressed={filters.rating === row.star}
                    aria-label={`Lọc ${row.star} sao: ${row.count} đánh giá`}
                    onClick={() =>
                      onFilters({
                        ...filters,
                        rating: filters.rating === row.star ? null : row.star,
                      })
                    }
                  >
                    <span>{row.star}</span>
                    <span className="roadmap-place-bar" aria-hidden>
                      <span
                        style={{ width: `${Math.round(row.share * 100)}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="roadmap-place-chips"
            role="group"
            aria-label="Sắp xếp và lọc đánh giá"
          >
            {reviewSortChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className="chip"
                aria-pressed={filters.sort === chip.value}
                onClick={() => onFilters({ ...filters, sort: chip.value })}
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-pressed={filters.hasImage}
              onClick={() =>
                onFilters({ ...filters, hasImage: !filters.hasImage })
              }
            >
              Có ảnh
            </button>
          </div>
          {data.items.length === 0 && (
            <p className="helper">
              {filtered
                ? "Không có đánh giá phù hợp. Thử bỏ bớt bộ lọc."
                : "Quán chưa có đánh giá nào."}
            </p>
          )}
        </>
      )}
      {data.items.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
      {last && page < data.totalPages && (
        <Button variant="secondary" onClick={onMore}>
          Xem thêm đánh giá
        </Button>
      )}
    </>
  );
}

function ReviewsPanel({
  restaurantId,
  service,
}: {
  restaurantId: number;
  service: PlaceService;
}) {
  const [filters, setFilters] = useState<ReviewFilters>({
    rating: null,
    hasImage: false,
    sort: "newest",
  });
  const [pages, setPages] = useState(1);
  return (
    <div className="roadmap-place-panel roadmap-place-reviews">
      {Array.from({ length: pages }, (_, index) => (
        <ReviewPage
          key={`${filters.rating}:${filters.hasImage}:${filters.sort}:${index}`}
          restaurantId={restaurantId}
          service={service}
          filters={filters}
          page={index + 1}
          last={index + 1 === pages}
          onFilters={(next) => {
            setFilters(next);
            setPages(1);
          }}
          onMore={() => setPages((value) => value + 1)}
        />
      ))}
      <Link
        className="roadmap-place-link"
        href={restaurantHref(restaurantId)}
        prefetch={false}
      >
        Viết đánh giá trên trang quán →
      </Link>
    </div>
  );
}

/**
 * "Ảnh": every photo of the dish (DISH-02) and of its restaurant (REST-02) in two columns, like
 * Wanderlog. A photo opens full size over the page (X or Escape closes it).
 */
function PhotosPanel({
  dishName,
  restaurantName,
  dish,
  restaurant,
  onRetryDish,
  onRetryRestaurant,
}: {
  dishName: string;
  restaurantName: string;
  dish: Remote<DishDetailDto>;
  restaurant: Remote<RestaurantDetailDto>;
  onRetryDish: () => void;
  onRetryRestaurant: () => void;
}) {
  const photos = [
    ...(dish.status === "ready"
      ? photosOf(dish.data.coverUrl, dish.data.images).map((url) => ({
          url,
          alt: `Ảnh món ${dishName}`,
        }))
      : []),
    ...(restaurant.status === "ready"
      ? photosOf(restaurant.data.coverUrl, restaurant.data.images).map(
          (url) => ({ url, alt: `Ảnh quán ${restaurantName}` }),
        )
      : []),
  ].filter(
    (photo, index, all) =>
      all.findIndex((other) => other.url === photo.url) === index,
  );
  const loading = dish.status === "loading" || restaurant.status === "loading";
  const [viewing, setViewing] = useState<number | null>(null);
  return (
    <div className="roadmap-place-panel">
      {dish.status === "error" && (
        <LoadFailed
          title="Chưa tải được ảnh món."
          error={dish.error}
          onRetry={onRetryDish}
        />
      )}
      {restaurant.status === "error" && (
        <LoadFailed
          title="Chưa tải được ảnh quán."
          error={restaurant.error}
          onRetry={onRetryRestaurant}
        />
      )}
      {photos.length > 0 && (
        <ul className="roadmap-place-photos" aria-label="Ảnh món và ảnh quán">
          {photos.map((photo, index) => (
            <li key={photo.url}>
              <button
                type="button"
                aria-label={`Xem lớn ${photo.alt.toLowerCase()} (${index + 1}/${photos.length})`}
                onClick={() => setViewing(index)}
              >
                <Media src={photo.url} alt={photo.alt} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <PhotoLightbox
        photos={photos}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
      {loading && <Loading />}
      {!loading && photos.length === 0 && (
        <p className="helper">Món và quán này chưa có ảnh nào.</p>
      )}
    </div>
  );
}

/**
 * The stop selected on the map: its dish (DISH-02), its restaurant (REST-02) and the restaurant's
 * reviews (REST-04). A tab loads when it is first opened and keeps its answer while the card is open.
 */
export function RoadmapPlaceCard({
  stop,
  coincident,
  onSelectItem,
  service = exploreService,
}: {
  stop: RoadmapMapStop;
  coincident: readonly RoadmapMapStop[];
  onSelectItem: (id: number | null) => void;
  service?: PlaceService;
}) {
  const [tab, setTab] = useState<PlaceTab>("dish");
  const [visited, setVisited] = useState<readonly PlaceTab[]>(["dish"]);
  const { dish } = stop.item;
  const place = [dish.restaurant.district, dish.restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  // DISH-02 serves "Món ăn" and "Ảnh"; REST-02 "Quán hàng" and "Ảnh", once either is opened.
  const [dishState, retryDish] = useRemote<DishDetailDto>(
    () => service.dish(dish.id),
    String(dish.id),
  );
  const wantsRestaurant =
    visited.includes("restaurant") || visited.includes("photos");
  const [restaurantState, retryRestaurant] = useRemote<RestaurantDetailDto>(
    // Not asked before it is needed: the remote waits on a promise that never settles.
    () =>
      wantsRestaurant
        ? service.restaurant(dish.restaurant.id)
        : new Promise<RestaurantDetailDto>(() => undefined),
    `${dish.restaurant.id}:${wantsRestaurant}`,
  );
  const restaurantStatus =
    restaurantState.status === "ready"
      ? operatingBadge(
          restaurantState.data.operatingStatus,
          restaurantState.data.isOpenNow,
        )
      : null;
  const panels: Record<PlaceTab, ReactNode> = {
    dish: <DishPanel stop={stop} state={dishState} onRetry={retryDish} />,
    restaurant: (
      <RestaurantPanel state={restaurantState} onRetry={retryRestaurant} />
    ),
    reviews: (
      <ReviewsPanel restaurantId={dish.restaurant.id} service={service} />
    ),
    photos: (
      <PhotosPanel
        dishName={dish.name}
        restaurantName={dish.restaurant.name}
        dish={dishState}
        restaurant={restaurantState}
        onRetryDish={retryDish}
        onRetryRestaurant={retryRestaurant}
      />
    ),
  };
  return (
    <section
      className="roadmap-map-card roadmap-place"
      aria-label="Địa điểm đã chọn"
    >
      <div className="roadmap-map-card-heading">
        <Tabs
          label="Thông tin địa điểm"
          value={tab}
          items={[...placeTabs]}
          onChange={(value) => {
            const next = placeTabs.find((item) => item.value === value);
            if (!next) return;
            setTab(next.value);
            setVisited((previous) =>
              previous.includes(next.value)
                ? previous
                : [...previous, next.value],
            );
          }}
        />
        <Button
          variant="icon"
          aria-label="Đóng thông tin địa điểm"
          onClick={() => onSelectItem(null)}
        >
          <Icon name="X" />
        </Button>
      </div>
      <div className="roadmap-map-card-body">
        <header className="roadmap-place-head" hidden={tab === "photos"}>
          <span
            className="roadmap-place-number"
            data-tone={(stop.dayNumber - 1) % 5}
          >
            {stop.number}
          </span>
          <div>
            <h3>{dish.name}</h3>
            <p className="roadmap-place-restaurant">
              {/* One line: a long name fades out so the status badge stays beside it. */}
              <FadingText
                text={
                  place
                    ? `${dish.restaurant.name} · ${place}`
                    : dish.restaurant.name
                }
              >
                {dish.restaurant.name}
                {place && <span className="helper"> · {place}</span>}
              </FadingText>
              {/* On "Quán hàng", once REST-02 answered: open now or not, beside the name. */}
              {tab === "restaurant" && restaurantStatus && (
                <span
                  className="roadmap-place-status"
                  data-tone={restaurantStatus.tone}
                >
                  {restaurantStatus.text}
                </span>
              )}
            </p>
            <p className="helper">
              {stop.dayLabel} · {mealSlotLabels[stop.item.mealSlot]} ·{" "}
              <span className="roadmap-map-included">Có trong lộ trình</span>
            </p>
            {!stop.coordinate && (
              <p className="helper">Địa điểm này chưa có tọa độ trên bản đồ.</p>
            )}
          </div>
        </header>
        {placeTabs.map(({ value, label }) =>
          visited.includes(value) ? (
            <div
              key={value}
              role="tabpanel"
              aria-label={label}
              hidden={tab !== value}
            >
              {panels[value]}
            </div>
          ) : null,
        )}
        {coincident.length > 1 && (
          <div className="roadmap-map-coincident">
            <p className="helper">
              {coincident.length} điểm trong lộ trình cùng vị trí
            </p>
            {coincident.map((point) => (
              <button
                key={point.item.id}
                type="button"
                aria-pressed={point.item.id === stop.item.id}
                onClick={() => onSelectItem(point.item.id)}
              >
                {point.dayLabel} · {point.number}. {point.item.dish.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
