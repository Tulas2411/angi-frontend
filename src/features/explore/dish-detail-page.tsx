"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Dialog,
  Media,
  Skeleton,
} from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import {
  cloudinaryImage,
  dishFormLabels,
  dishImageTransforms,
  dishPictures,
  googleMapsPlaceHref,
  locationText,
  operatingBadge,
  otherMenuDishes,
  priceLevelText,
  ratingSummary,
  vnd,
} from "./explore-rules";
import { DishTile } from "./dish-views";
import { exploreRoutes, restaurantHref } from "./explore-routes";
import { exploreService, type ExploreService } from "./explore-service";
import type { DishDetailDto, RestaurantCardDto } from "./explore-types";
import { useRemote } from "./use-remote";
import "./explore.css";
import "./dish-detail.css";

/**
 * The dish photo on a backdrop made from the same photo, blurred. The photo keeps its own aspect
 * ratio and is never drawn larger than the file, so small or portrait uploads stay sharp and whole;
 * the backdrop fills the rest of the square. A failed Cloudinary transformation falls back to the
 * original URL, and a missing or broken original shows the shared "Chưa có ảnh" placeholder.
 */
function DishStage({ dish }: { dish: DishDetailDto }) {
  const pictures = dishPictures(dish.coverUrl, dish.images);
  const [chosen, setChosen] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [plain, setPlain] = useState<string[]>([]);
  const [broken, setBroken] = useState<string[]>([]);
  const current = pictures[Math.min(chosen, pictures.length - 1)];
  const usable = current !== undefined && !broken.includes(current);
  const variant = (transformation: string) =>
    current === undefined || plain.includes(current)
      ? current
      : cloudinaryImage(current, transformation);
  const failed = () => {
    if (current === undefined) return;
    if (plain.includes(current)) setBroken((list) => [...list, current]);
    else setPlain((list) => [...list, current]);
  };
  return (
    <div className="dish-page-gallery">
      {usable ? (
        <figure
          className={`dish-page-stage${dish.isAvailable ? "" : " dish-page-stage-out"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="dish-page-stage-backdrop"
            src={variant(dishImageTransforms.backdrop)}
            alt=""
            aria-hidden
            onError={failed}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current}
            className="dish-page-stage-photo"
            src={variant(dishImageTransforms.stage)}
            alt={dish.name}
            onError={failed}
          />
          {!dish.isAvailable && (
            <span className="dish-page-stage-flag">Tạm hết món</span>
          )}
          <button
            type="button"
            className="dish-page-stage-zoom"
            aria-label={`Xem ảnh lớn của ${dish.name}`}
            onClick={() => setZoomed(true)}
            suppressHydrationWarning
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </figure>
      ) : (
        <Media className="dish-page-stage-empty" alt={dish.name} />
      )}
      {pictures.length > 1 && (
        <ul className="explore-thumbs" aria-label="Ảnh của món">
          {pictures.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                aria-label={`Xem ảnh ${index + 1} của ${dish.name}`}
                aria-pressed={index === chosen}
                onClick={() => setChosen(index)}
                suppressHydrationWarning
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {usable && (
        <Dialog
          open={zoomed}
          onClose={() => setZoomed(false)}
          title={dish.name}
          wide
          className="dish-page-zoom"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dish-page-zoom-photo" src={current} alt={dish.name} />
        </Dialog>
      )}
    </div>
  );
}

/** The restaurant that sells the dish, kept beside the dish so its actions stay in reach. */
function Seller({ restaurant }: { restaurant: RestaurantCardDto }) {
  const headingId = useId();
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  const price = priceLevelText(restaurant.priceLevel);
  const place = locationText(restaurant.district, restaurant.provinceName);
  const map = googleMapsPlaceHref(restaurant.latitude, restaurant.longitude);
  return (
    <section className="dish-page-seller" aria-labelledby={headingId}>
      <p className="eyebrow">Quán bán món này</p>
      <div className="dish-page-seller-top">
        <Media
          className="dish-page-seller-cover"
          src={restaurant.coverUrl ?? undefined}
          alt={restaurant.name}
        />
        <div className="dish-page-seller-name">
          <h2 id={headingId}>
            <Link href={restaurantHref(restaurant.id)}>{restaurant.name}</Link>
          </h2>
          <p className="dish-page-seller-meta">
            <span className={`dish-page-open dish-page-open-${status.tone}`}>
              <i aria-hidden />
              {status.text}
            </span>
            <span>
              {ratingSummary(restaurant.ratingAvg, restaurant.ratingCount)}
            </span>
            {price && <span>Giá {price}</span>}
          </p>
        </div>
      </div>
      <p className="helper">
        {restaurant.addressLine}
        {place && ` · ${place}`}
      </p>
      <div className="actions dish-page-seller-actions">
        <ActionLink href={restaurantHref(restaurant.id)}>Xem quán</ActionLink>
        {map && (
          <a
            className="button button-secondary"
            href={map}
            target="_blank"
            rel="noreferrer"
            aria-label="Chỉ đường trên Google Maps"
          >
            Chỉ đường
          </a>
        )}
      </div>
    </section>
  );
}

/** "Món khác ở quán": the rest of the restaurant's menu (REST-03) as a swipeable row. */
function OtherDishes({
  restaurant,
  dishId,
  service,
}: {
  restaurant: RestaurantCardDto;
  dishId: number;
  service: ExploreService;
}) {
  const headingId = useId();
  const [state, retry] = useRemote(
    () => service.menu(restaurant.id),
    `menu-${restaurant.id}`,
  );
  const heading = <h2 id={headingId}>Món khác ở {restaurant.name}</h2>;
  if (state.status === "loading")
    return (
      <section className="dish-page-more" aria-labelledby={headingId}>
        {heading}
        <Skeleton rows={2} />
      </section>
    );
  if (state.status === "error")
    return (
      <section className="dish-page-more" aria-labelledby={headingId}>
        {heading}
        <Alert>{getErrorMessage(state.error)}</Alert>
        <div className="actions">
          <Button onClick={retry}>Thử lại</Button>
        </div>
      </section>
    );
  const dishes = otherMenuDishes(state.data?.dishes ?? [], dishId);
  if (dishes.length === 0) return null;
  return (
    <section className="dish-page-more" aria-labelledby={headingId}>
      {heading}
      {/* The same "Thư viện ảnh" tiles as the dish and restaurant lists: photo and name, no price. */}
      <ul className="dish-items dish-items-gallery">
        {dishes.map((other) => (
          <li key={other.id}>
            <DishTile dish={other} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** F-13 View Dish Detail: DISH-02 with the restaurant that sells it and its other dishes (REST-03). */
export function DishDetailPage({
  dishId,
  service = exploreService,
}: {
  dishId: number;
  service?: ExploreService;
}) {
  const [state, retry] = useRemote(() => service.dish(dishId), String(dishId));
  if (state.status === "loading") return <Skeleton rows={5} />;
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      (state.error.errorCode === "DISH_NOT_FOUND" ||
        state.error.status === 404);
    return (
      <Card title={missing ? "Không tìm thấy món" : "Chưa tải được món ăn"}>
        {missing ? (
          <p>Món này không tồn tại hoặc đã được gỡ khỏi ANGI.</p>
        ) : (
          <Alert>{getErrorMessage(state.error)}</Alert>
        )}
        <div className="actions">
          {!missing && <Button onClick={retry}>Thử lại</Button>}
          <ActionLink href={exploreRoutes.dishes} secondary>
            Về danh sách món
          </ActionLink>
        </div>
      </Card>
    );
  }
  const dish = state.data;
  const restaurant = dish.restaurant;
  return (
    <div className="stack dish-page">
      <nav className="explore-back" aria-label="Quay lại">
        <Link href={exploreRoutes.dishes}>← Tất cả món ăn</Link>
      </nav>
      <div className="dish-page-hero">
        <DishStage key={dish.id} dish={dish} />
        <div className="dish-page-panel">
          <div className="dish-page-title">
            <p className="eyebrow">
              {dishFormLabels[dish.dishForm]} · {restaurant.name}
            </p>
            <h1>{dish.name}</h1>
          </div>
          <p className="dish-page-price">{vnd(dish.price)}</p>
          {(dish.tags.length > 0 || !dish.isAvailable) && (
            <p className="dish-page-tags">
              {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
              {dish.tags.map((tag) => (
                <span key={tag.id} className="dish-page-tag">
                  {tag.name}
                </span>
              ))}
            </p>
          )}
          {dish.description && (
            <p className="dish-page-description">{dish.description}</p>
          )}
          <Seller restaurant={restaurant} />
        </div>
      </div>
      <OtherDishes
        key={restaurant.id}
        restaurant={restaurant}
        dishId={dish.id}
        service={service}
      />
      <p className="dish-page-note">
        Giá, thành phần và giờ mở cửa có thể thay đổi. Nếu bạn có dị ứng, hãy
        hỏi quán trước khi ăn.
      </p>
    </div>
  );
}
