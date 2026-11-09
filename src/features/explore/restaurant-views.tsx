"use client";
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
import { CardName, DescriptionText } from "./dish-views";

/**
 * The score as a tag hung in the card's top-right corner (on the photo in the gallery); a
 * restaurant without reviews yet is marked "Mới". It lets clicks through to the link over the card.
 */
function RatingBadge({ restaurant }: { restaurant: RestaurantCardDto }) {
  if (restaurant.ratingCount === 0)
    return (
      <p className="rating-badge is-new">
        <span aria-hidden="true">✦</span> Mới
        <span className="sr-only"> · chưa có đánh giá</span>
      </p>
    );
  const score = ratingText(restaurant.ratingAvg);
  const count = restaurant.ratingCount.toLocaleString("vi-VN");
  return (
    <p className="rating-badge">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m10 2.2 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7Z" />
      </svg>
      <span aria-hidden="true">{score}</span>
      <span className="rating-badge-count" aria-hidden="true">
        ({count})
      </span>
      <span className="sr-only">
        {score} trên 5 sao, {count} đánh giá
      </span>
    </p>
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

function RestaurantName({
  restaurant,
  lines,
}: {
  restaurant: RestaurantCardDto;
  lines: 1 | 3;
}) {
  return (
    <CardName
      id={`restaurant-${restaurant.id}`}
      href={restaurantHref(restaurant.id)}
      name={restaurant.name}
      lines={lines}
    />
  );
}

function RestaurantBody({ restaurant }: { restaurant: RestaurantCardDto }) {
  return (
    <div className="dish-body">
      {/* The tag sits in the name's row, so a long name gives way to it instead of running under. */}
      <div className="dish-head">
        <RestaurantName restaurant={restaurant} lines={1} />
        <RatingBadge restaurant={restaurant} />
      </div>
      <RestaurantKinds restaurant={restaurant} />
      <DescriptionText
        id={`restaurant-description-${restaurant.id}`}
        text={restaurant.description}
        emptyText="Quán chưa có mô tả."
      />
      <RestaurantPlace restaurant={restaurant} />
    </div>
  );
}

/** Mode 1: one restaurant per row across the width, the photo filling its left edge. */
export function RestaurantRow(props: { restaurant: RestaurantCardDto }) {
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
export function RestaurantDetailCard(props: { restaurant: RestaurantCardDto }) {
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
      <RatingBadge restaurant={restaurant} />
      <RestaurantName restaurant={restaurant} lines={3} />
    </article>
  );
}
