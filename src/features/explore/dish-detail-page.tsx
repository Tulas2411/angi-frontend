"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import { ActionLink, Media, Skeleton } from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import {
  dishFormLabels,
  googleMapsPlaceHref,
  locationText,
  operatingBadge,
  priceLevelText,
  ratingSummary,
  vnd,
} from "./explore-rules";
import { exploreRoutes, restaurantHref } from "./explore-routes";
import { exploreService, type ExploreService } from "./explore-service";
import type { DishDetailDto } from "./explore-types";
import { useRemote } from "./use-remote";
import "./explore.css";

function Gallery({ dish }: { dish: DishDetailDto }) {
  const pictures = [
    ...(dish.coverUrl ? [dish.coverUrl] : []),
    ...dish.images.filter((url) => url !== dish.coverUrl),
  ];
  const [chosen, setChosen] = useState(0);
  const current = pictures[Math.min(chosen, pictures.length - 1)];
  return (
    <div className="explore-gallery">
      <Media src={current} alt={dish.name} />
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
    </div>
  );
}

/** F-13 View Dish Detail: DISH-02 with the restaurant that sells it. */
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
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  const price = priceLevelText(restaurant.priceLevel);
  const place = locationText(restaurant.district, restaurant.provinceName);
  const map = googleMapsPlaceHref(restaurant.latitude, restaurant.longitude);
  return (
    <div className="stack">
      <nav className="explore-back" aria-label="Quay lại">
        <Link href={exploreRoutes.dishes}>← Tất cả món ăn</Link>
      </nav>
      <div className="explore-hero">
        <Gallery dish={dish} />
        <div className="stack-sm">
          <p className="eyebrow">{dishFormLabels[dish.dishForm]}</p>
          <h1>{dish.name}</h1>
          <p className="explore-price explore-price-lg">{vnd(dish.price)}</p>
          <p className="explore-chips">
            {dish.tags.map((tag) => (
              <span key={tag.id}>{tag.name}</span>
            ))}
            {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
          </p>
          {dish.description && <p>{dish.description}</p>}
          <Alert tone="info">
            Giá, thành phần và giờ mở cửa có thể thay đổi. Nếu bạn có dị ứng,
            hãy hỏi quán trước khi ăn.
          </Alert>
        </div>
      </div>
      <Card title="Quán bán món này">
        <div className="explore-restaurant">
          <Media src={restaurant.coverUrl ?? undefined} alt={restaurant.name} />
          <div className="stack-sm">
            <h3>
              <Link href={restaurantHref(restaurant.id)}>
                {restaurant.name}
              </Link>
            </h3>
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
            <div className="actions">
              <ActionLink href={restaurantHref(restaurant.id)}>
                Xem quán
              </ActionLink>
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
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
