"use client";
import { useEffect, useId, useRef, useState } from "react";
import { HeartIcon } from "@heroicons/react/20/solid";
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
  menuPreview,
  operatingBadge,
  priceLevelText,
  priceTag,
  ratingSummary,
} from "./explore-rules";
import { DishTile } from "./dish-views";
import { exploreRoutes, restaurantHref } from "./explore-routes";
import { exploreService, type ExploreService } from "./explore-service";
import type { DishDetailDto, RestaurantCardDto } from "./explore-types";
import { useRemote } from "./use-remote";
import "./explore.css";
import "./wood-plate.css";
import "./dish-detail.css";

/**
 * The dish served on a round wooden plate: the photo is cropped to a circle inside a turned-wood
 * rim, so every upload (small, square or portrait) reads as the same plate. The plate is a button
 * that opens the photo alone in a dialog. A failed Cloudinary transformation falls back to the
 * original URL, and a missing or broken original shows the shared "Chưa có ảnh" placeholder.
 */
function DishPlate({ dish }: { dish: DishDetailDto }) {
  const pictures = dishPictures(dish.coverUrl, dish.images);
  const [chosen, setChosen] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [plain, setPlain] = useState<string[]>([]);
  const [broken, setBroken] = useState<string[]>([]);
  const current = pictures[Math.min(chosen, pictures.length - 1)];
  const usable = current !== undefined && !broken.includes(current);
  const shown =
    current === undefined || plain.includes(current)
      ? current
      : cloudinaryImage(current, dishImageTransforms.stage);
  const failed = () => {
    if (current === undefined) return;
    if (plain.includes(current)) setBroken((list) => [...list, current]);
    else setPlain((list) => [...list, current]);
  };
  return (
    <div className="dish-page-gallery">
      <figure
        className={`dish-plate${dish.isAvailable ? "" : " dish-plate-out"}`}
      >
        {/* The same walnut plate as the restaurant's menu wheel (wood-plate.css). */}
        <span className="wood-plate">
          {usable ? (
            <button
              type="button"
              className="wood-plate-food dish-plate-food"
              aria-label={`Xem ảnh lớn của ${dish.name}`}
              onClick={() => setZoomed(true)}
              suppressHydrationWarning
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={current} src={shown} alt={dish.name} onError={failed} />
            </button>
          ) : (
            <Media
              className="wood-plate-food dish-plate-empty"
              alt={dish.name}
            />
          )}
        </span>
        {!dish.isAvailable && (
          <span className="dish-plate-flag">Tạm hết món</span>
        )}
      </figure>
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
          className="dish-page-zoom"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dish-page-zoom-photo" src={current} alt={dish.name} />
        </Dialog>
      )}
    </div>
  );
}

/**
 * The description, four lines at most: a longer one fades out on its last line and "Xem thêm"
 * below shows it whole ("Thu gọn" folds it again). The button only appears when text is cut.
 */
function DishDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || open) return;
    const observer = new ResizeObserver(() =>
      setCut(element.scrollHeight > element.clientHeight + 1),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, text]);
  return (
    <div className="dish-page-description">
      <p
        ref={ref}
        data-folded={open ? undefined : ""}
        data-cut={cut && !open ? "" : undefined}
      >
        {text}
      </p>
      {(cut || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Thu gọn" : "Xem thêm"}
        </button>
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

/** "Khám phá menu ở {quán}": the restaurant's menu (REST-03), four tall tiles a row. */
function OtherDishes({
  restaurant,
  service,
}: {
  restaurant: RestaurantCardDto;
  service: ExploreService;
}) {
  const headingId = useId();
  const [state, retry] = useRemote(
    () => service.menu(restaurant.id),
    `menu-${restaurant.id}`,
  );
  const heading = <h2 id={headingId}>Khám phá menu ở {restaurant.name}</h2>;
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
  const dishes = menuPreview(state.data?.dishes ?? []);
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
        <div className="dish-page-intro">
          <DishPlate key={dish.id} dish={dish} />
          <p className="dish-page-kicker">Chi tiết · Hương vị & đặc điểm</p>
          <h1>{dish.name}</h1>
          {dish.description && <DishDescription text={dish.description} />}
          <ul className="dish-page-facts">
            <li className="dish-page-price">{priceTag(dish.price)}</li>
            <li>{dishFormLabels[dish.dishForm]}</li>
            <li>
              <HeartIcon aria-hidden />
              {dish.likeCount}
              <span className="sr-only"> lượt thích</span>
            </li>
            {!dish.isAvailable && (
              <li>
                <Badge tone="warning">Tạm hết món</Badge>
              </li>
            )}
          </ul>
          {dish.tags.length > 0 && (
            <ul className="dish-page-tags" aria-label="Đặc điểm">
              {dish.tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="dish-page-side">
          <Seller restaurant={restaurant} />
          <OtherDishes
            key={restaurant.id}
            restaurant={restaurant}
            service={service}
          />
        </div>
      </div>
    </div>
  );
}
