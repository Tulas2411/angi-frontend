"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui";
import { Avatar, Icon, Media, Tabs } from "@/components/ui/primitives";
import { getErrorMessage } from "@/shared/api/error";
import {
  businessHoursByDay,
  dishFormLabels,
  googleMapsPlaceHref,
  operatingBadge,
  priceLevelText,
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
import { useRemote } from "@/features/explore/use-remote";
import { mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import type { RoadmapMapStop } from "./roadmap-map-rules";
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
] as const;
type PlaceTab = (typeof placeTabs)[number]["value"];

/** REST-04 page size inside the card; "Xem thêm đánh giá" asks for the next page. */
const cardReviewPageSize = 5;

const reviewSortChips: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "rating_desc", label: "Cao nhất" },
  { value: "rating_asc", label: "Thấp nhất" },
];

const svg = (path: string) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d={path} />
  </svg>
);
const placeIcons = {
  pin: svg(
    "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z",
  ),
  clock: svg(
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.6 3.5 2.1-.8 1.3L11 13.3V7h2v5.6Z",
  ),
  phone: svg(
    "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z",
  ),
  web: svg(
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16ZM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8Zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6Zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4Z",
  ),
};

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

/** One large photo and a strip of the others; a thumbnail becomes the large photo. */
function Gallery({
  images,
  alt,
  mainClassName = "",
}: {
  images: readonly string[];
  alt: string;
  mainClassName?: string;
}) {
  const [shown, setShown] = useState(0);
  const current = images[Math.min(shown, images.length - 1)];
  return (
    <div className="roadmap-place-gallery">
      <Media
        className={`roadmap-place-photo ${mainClassName}`.trim()}
        src={current}
        alt={alt}
      />
      {images.length > 1 && (
        <ul aria-label={`Ảnh khác của ${alt}`}>
          {images.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                aria-label={`Xem ảnh ${index + 1} / ${images.length}`}
                aria-pressed={index === shown}
                onClick={() => setShown(index)}
              >
                <Media src={url} alt="" />
              </button>
            </li>
          ))}
        </ul>
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

/** DISH-02, with what RM-03 already knows shown at once. */
function DishPanel({
  stop,
  service,
}: {
  stop: RoadmapMapStop;
  service: PlaceService;
}) {
  const { dish } = stop.item;
  const [state, retry] = useRemote<DishDetailDto>(
    () => service.dish(dish.id),
    String(dish.id),
  );
  const detail = state.status === "ready" ? state.data : null;
  const images = [
    ...new Set(
      [detail?.coverUrl ?? dish.coverUrl, ...(detail?.images ?? [])].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  ];
  const tags = detail?.tags ?? dish.tags;
  const likes = detail?.likeCount ?? dish.likeCount;
  const dislikes = detail?.dislikeCount ?? dish.dislikeCount;
  const available = detail?.isAvailable ?? dish.isAvailable;
  return (
    <div className="roadmap-place-panel">
      <div className="roadmap-place-lead">
        <dl className="roadmap-place-facts">
          <div>
            <dt>Giá</dt>
            <dd>
              <strong>{vnd(detail?.price ?? dish.price)}</strong>
            </dd>
          </div>
          <div>
            <dt>Loại món</dt>
            <dd>{dishFormLabels[detail?.dishForm ?? dish.dishForm]}</dd>
          </div>
          <div>
            <dt>Tình trạng</dt>
            <dd data-tone={available ? "success" : "warning"}>
              {available ? "Đang bán" : "Tạm hết"}
            </dd>
          </div>
          <div>
            <dt>Cảm nhận</dt>
            <dd>
              <span aria-label={`${likes} lượt thích`}>👍 {likes}</span>{" "}
              <span aria-label={`${dislikes} lượt không thích`}>
                👎 {dislikes}
              </span>
            </dd>
          </div>
        </dl>
        <Gallery
          images={images}
          alt={`Ảnh món ${dish.name}`}
          mainClassName="roadmap-map-card-photo"
        />
      </div>
      {tags.length > 0 && (
        <ul className="roadmap-place-tags" aria-label="Thẻ của món">
          {tags.map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
      )}
      {state.status === "loading" && <Loading />}
      {state.status === "error" && (
        <LoadFailed
          title="Chưa tải được mô tả món."
          error={state.error}
          onRetry={retry}
        />
      )}
      {detail &&
        (detail.description ? (
          <LongText text={detail.description} />
        ) : (
          <p className="helper">Quán chưa viết mô tả cho món này.</p>
        ))}
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
  restaurantId,
  service,
}: {
  restaurantId: number;
  service: PlaceService;
}) {
  const [state, retry] = useRemote<RestaurantDetailDto>(
    () => service.restaurant(restaurantId),
    String(restaurantId),
  );
  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <LoadFailed
        title="Chưa tải được thông tin quán."
        error={state.error}
        onRetry={retry}
      />
    );
  const restaurant = state.data;
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  const price = priceLevelText(restaurant.priceLevel);
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
  const images = [
    ...new Set(
      [restaurant.coverUrl, ...restaurant.images].filter((url): url is string =>
        Boolean(url),
      ),
    ),
  ];
  return (
    <div className="roadmap-place-panel">
      <p className="roadmap-place-score">
        {restaurant.ratingCount > 0 ? (
          <>
            <strong>{ratingText(restaurant.ratingAvg)}</strong>
            <Stars value={restaurant.ratingAvg} />
            <span>({restaurant.ratingCount})</span>
          </>
        ) : (
          <span>Chưa có đánh giá</span>
        )}
        {price && <span aria-label={`Mức giá ${price}`}>· {price}</span>}
        <span className="roadmap-place-status" data-tone={status.tone}>
          {status.text}
        </span>
      </p>
      {images.length > 0 && (
        <Gallery images={images} alt={`Ảnh quán ${restaurant.name}`} />
      )}
      <ul className="roadmap-place-rows">
        <li>
          {placeIcons.pin}
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
          {placeIcons.clock}
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
            {placeIcons.phone}
            <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`}>
              {restaurant.phone}
            </a>
          </li>
        )}
        {restaurant.website && (
          <li>
            {placeIcons.web}
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
  const panels: Record<PlaceTab, ReactNode> = {
    dish: <DishPanel stop={stop} service={service} />,
    restaurant: (
      <RestaurantPanel restaurantId={dish.restaurant.id} service={service} />
    ),
    reviews: (
      <ReviewsPanel restaurantId={dish.restaurant.id} service={service} />
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
        <header className="roadmap-place-head">
          <span
            className="roadmap-place-number"
            data-tone={(stop.dayNumber - 1) % 5}
          >
            {stop.number}
          </span>
          <div>
            <h3>{dish.name}</h3>
            <p>
              {dish.restaurant.name}
              {place && <span className="helper"> · {place}</span>}
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
