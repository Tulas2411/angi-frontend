"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button } from "@/shared/ui";
import { Dialog, Media, Skeleton } from "@/components/ui/primitives";
import { exploreService } from "@/features/explore/explore-service";
import { dishHref, restaurantHref } from "@/features/explore/explore-routes";
import {
  dishFormLabels,
  operatingBadge,
  ratingSummary,
  vnd,
} from "@/features/explore/explore-rules";
import { useRemote } from "@/features/explore/use-remote";
import type { DishDetailDto } from "@/features/explore/explore-types";
import { ApiError, getErrorMessage } from "@/shared/api/error";

export interface RollDishPreview {
  id: number;
  name: string;
  visit: number;
}

/** DISH-02 is loaded only on activation, never on hover or while the strip is spinning. */
export function RollDishDialog({
  preview,
  open,
  onClose,
}: {
  preview: RollDishPreview | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={preview?.name ?? "Chi tiết món ăn"}
      className="roll-dish-dialog"
      footer={<Button onClick={onClose}>Tiếp tục roll</Button>}
    >
      {preview && (
        <DishContent
          key={`${preview.id}:${preview.visit}`}
          dishId={preview.id}
        />
      )}
    </Dialog>
  );
}

function DishContent({ dishId }: { dishId: number }) {
  const [state, retry] = useRemote(
    () => exploreService.dish(dishId),
    String(dishId),
  );
  if (state.status === "loading")
    return (
      <div role="status" aria-label="Đang tải chi tiết món">
        <Skeleton rows={4} />
      </div>
    );
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      (state.error.errorCode === "DISH_NOT_FOUND" ||
        state.error.status === 404);
    return (
      <div className="stack">
        <Alert>
          {missing
            ? "Món này không còn hiển thị hoặc đã được gỡ khỏi ANGI."
            : getErrorMessage(state.error)}
        </Alert>
        {!missing && (
          <Button variant="secondary" onClick={retry}>
            Thử lại
          </Button>
        )}
      </div>
    );
  }
  const dish = state.data;
  const restaurant = dish.restaurant;
  // The current BE contract uses ward; older Explore wire types still contain district.
  const ward =
    "ward" in restaurant && typeof restaurant.ward === "string"
      ? restaurant.ward
      : null;
  const address = [restaurant.addressLine, ward, restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  const status = operatingBadge(
    restaurant.operatingStatus,
    restaurant.isOpenNow,
  );
  return (
    <div className="roll-dish-detail">
      <DishPhotos dish={dish} />
      <div className="roll-dish-summary stack-sm">
        <p className="eyebrow">{dishFormLabels[dish.dishForm]}</p>
        <p className="roll-dish-price">{vnd(dish.price)}</p>
        <div className="roll-dish-tags">
          {dish.tags.map((tag) => (
            <span key={tag.id}>{tag.name}</span>
          ))}
          {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
        </div>
        {dish.description && (
          <p className="roll-dish-description">{dish.description}</p>
        )}
        <p className="helper">
          {dish.likeCount.toLocaleString("vi-VN")} lượt thích ·{" "}
          {dish.dislikeCount.toLocaleString("vi-VN")} lượt không thích
        </p>
      </div>
      <section
        className="roll-dish-restaurant stack-sm"
        aria-label="Quán bán món này"
      >
        <p className="eyebrow">Thưởng thức tại</p>
        <h3>{restaurant.name}</h3>
        {address && <p>{address}</p>}
        <div className="roll-dish-tags">
          <Badge tone={status.tone}>{status.text}</Badge>
          <span>
            {ratingSummary(restaurant.ratingAvg, restaurant.ratingCount)}
          </span>
        </div>
        <div className="roll-dish-links">
          <Link
            className="button button-secondary"
            href={restaurantHref(restaurant.id)}
          >
            Xem quán ăn
          </Link>
          <Link className="text-link" href={dishHref(dish.id)}>
            Mở trang món ăn ↗
          </Link>
        </div>
      </section>
    </div>
  );
}

function DishPhotos({ dish }: { dish: DishDetailDto }) {
  const pictures = [
    ...new Set(
      [dish.coverUrl, ...dish.images].filter((url): url is string => !!url),
    ),
  ];
  const [selected, setSelected] = useState(0);
  return (
    <div className="roll-dish-gallery">
      <Media src={pictures[selected]} alt={dish.name} />
      {pictures.length > 1 && (
        <div className="roll-dish-thumbs" role="group" aria-label="Ảnh của món">
          {pictures.map((url, index) => (
            <button
              key={url}
              type="button"
              aria-label={`Xem ảnh ${index + 1} của ${dish.name}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <Media src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
