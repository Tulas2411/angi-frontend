"use client";
import Link from "next/link";
import { Badge } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { restaurantHref } from "./explore-routes";
import {
  operatingBadge,
  priceLevelOptions,
  priceLevelText,
  ratingText,
} from "./explore-rules";
import type { RestaurantCardDto } from "./explore-types";
import { DescriptionText } from "./dish-views";
import type { DishDescription } from "./use-dish-descriptions";

/** The star score where a dish shows its likes. */
function RatingScore({ restaurant }: { restaurant: RestaurantCardDto }) {
  if (restaurant.ratingCount === 0)
    return (
      <span className="dish-likes restaurant-score">Chưa có đánh giá</span>
    );
  return (
    <span
      className="dish-likes restaurant-score"
      aria-label={`${ratingText(restaurant.ratingAvg)} trên 5 sao, ${restaurant.ratingCount} đánh giá`}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m10 2.2 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7Z" />
      </svg>
      <span aria-hidden="true">
        {ratingText(restaurant.ratingAvg)} (
        {restaurant.ratingCount.toLocaleString("vi-VN")})
      </span>
    </span>
  );
}

/** Opening state first, then the price level: the type line under the name. */
function RestaurantKinds({ restaurant }: { restaurant: RestaurantCardDto }) {
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  const level = priceLevelOptions.find(
    (option) => option.value === String(restaurant.priceLevel ?? ""),
  );
  return (
    <p className="dish-kinds">
      <Badge tone={status.tone}>{status.text}</Badge>
      {restaurant.priceLevel !== null && level?.value && (
        <span className="dish-tag">{level.label}</span>
      )}
    </p>
  );
}

/** The address (street, ward, province) where a dish shows its restaurant. */
function RestaurantPlace({ restaurant }: { restaurant: RestaurantCardDto }) {
  const address = [
    restaurant.addressLine,
    restaurant.ward,
    restaurant.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
  const price = priceLevelText(restaurant.priceLevel);
  return (
    <p className="dish-place">
      {price && (
        <strong className="dish-price" aria-label={`Mức giá ${price}`}>
          {price}
        </strong>
      )}
      <span className="dish-place-name" title={address}>
        {address}
      </span>
    </p>
  );
}

function RestaurantName({ restaurant }: { restaurant: RestaurantCardDto }) {
  return (
    <h3 id={`restaurant-${restaurant.id}`} className="dish-name">
      <Link href={restaurantHref(restaurant.id)}>{restaurant.name}</Link>
    </h3>
  );
}

function RestaurantBody({
  restaurant,
  description,
  onRetry,
}: {
  restaurant: RestaurantCardDto;
  description: DishDescription;
  onRetry: () => void;
}) {
  return (
    <div className="dish-body">
      <div className="dish-head">
        <RestaurantName restaurant={restaurant} />
        <RatingScore restaurant={restaurant} />
      </div>
      <RestaurantKinds restaurant={restaurant} />
      <DescriptionText
        id={`restaurant-description-${restaurant.id}`}
        description={description}
        onRetry={onRetry}
        emptyText="Quán chưa có mô tả."
      />
      <RestaurantPlace restaurant={restaurant} />
    </div>
  );
}

/** Mode 1: one restaurant per row across the width, a small photo on the left. */
export function RestaurantRow(props: {
  restaurant: RestaurantCardDto;
  description: DishDescription;
  onRetry: () => void;
}) {
  const { restaurant } = props;
  return (
    <article
      className="dish-item dish-row"
      aria-labelledby={`restaurant-${restaurant.id}`}
    >
      <Media
        className="dish-thumb"
        src={restaurant.coverUrl ?? undefined}
        alt={restaurant.name}
      />
      <RestaurantBody {...props} />
    </article>
  );
}

/** Mode 2: two cards a row, a large photo on the left and every detail beside it. */
export function RestaurantDetailCard(props: {
  restaurant: RestaurantCardDto;
  description: DishDescription;
  onRetry: () => void;
}) {
  const { restaurant } = props;
  return (
    <article
      className="dish-item dish-detail"
      aria-labelledby={`restaurant-${restaurant.id}`}
    >
      <Media
        className="dish-photo"
        src={restaurant.coverUrl ?? undefined}
        alt={restaurant.name}
      />
      <RestaurantBody {...props} />
    </article>
  );
}

/** Mode 3: only the photo, with the name on it. */
export function RestaurantTile({
  restaurant,
}: {
  restaurant: RestaurantCardDto;
}) {
  return (
    <article
      className="dish-item dish-tile"
      aria-labelledby={`restaurant-${restaurant.id}`}
    >
      <Media
        className="dish-tile-photo"
        src={restaurant.coverUrl ?? undefined}
        alt=""
      />
      <RestaurantName restaurant={restaurant} />
    </article>
  );
}
