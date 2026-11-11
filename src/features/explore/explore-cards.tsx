import Link from "next/link";
import { Badge } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { dishHref, restaurantHref } from "./explore-routes";
import {
  dishFormLabels,
  locationText,
  operatingBadge,
  priceLevelText,
  ratingSummary,
  vnd,
} from "./explore-rules";
import type {
  DishCardDto,
  MenuDishDto,
  RestaurantCardDto,
} from "./explore-types";

/** One dish of a list: the whole card is a link to its detail page. */
export function DishCard({
  dish,
  showRestaurant = true,
}: {
  dish: DishCardDto | MenuDishDto;
  showRestaurant?: boolean;
}) {
  const restaurant = showRestaurant ? dish.restaurant : undefined;
  return (
    <article className="card explore-card" aria-labelledby={`dish-${dish.id}`}>
      <Media src={dish.coverUrl ?? undefined} alt={dish.name} />
      <div className="explore-card-body">
        <div className="stack-sm">
          <h3 id={`dish-${dish.id}`}>
            <Link href={dishHref(dish.id)}>{dish.name}</Link>
          </h3>
          <p className="explore-price">{vnd(dish.price)}</p>
          {restaurant && (
            <p className="helper">
              {restaurant.name}
              {locationText(restaurant.district, restaurant.provinceName) &&
                ` · ${locationText(restaurant.district, restaurant.provinceName)}`}
            </p>
          )}
        </div>
        <p className="explore-chips">
          <span>{dishFormLabels[dish.dishForm]}</span>
          {dish.tags.slice(0, 3).map((tag) => (
            <span key={tag.id}>{tag.name}</span>
          ))}
          {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
        </p>
      </div>
    </article>
  );
}

/** One restaurant of a list: the whole card is a link to its detail page. */
export function RestaurantCard({
  restaurant,
}: {
  restaurant: RestaurantCardDto;
}) {
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  const price = priceLevelText(restaurant.priceLevel);
  const place = locationText(restaurant.district, restaurant.provinceName);
  return (
    <article
      className="card explore-card"
      aria-labelledby={`restaurant-${restaurant.id}`}
    >
      <Media src={restaurant.coverUrl ?? undefined} alt={restaurant.name} />
      <div className="explore-card-body">
        <div className="stack-sm">
          <h3 id={`restaurant-${restaurant.id}`}>
            <Link href={restaurantHref(restaurant.id)}>{restaurant.name}</Link>
          </h3>
          <p className="helper">
            {restaurant.addressLine}
            {place && ` · ${place}`}
          </p>
          <p className="explore-price">
            {ratingSummary(restaurant.ratingAvg, restaurant.ratingCount)}
          </p>
        </div>
        <p className="explore-chips">
          <Badge tone={status.tone}>{status.text}</Badge>
          {price && <span>Giá {price}</span>}
        </p>
      </div>
    </article>
  );
}
