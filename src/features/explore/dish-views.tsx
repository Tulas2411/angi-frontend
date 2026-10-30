"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { dishHref } from "./explore-routes";
import { dishFormLabels, locationText, vnd } from "./explore-rules";
import type { DishCardDto } from "./explore-types";
import { dishViews, type DishView } from "./dish-view-mode";
import type { DishDescription } from "./use-dish-descriptions";

const viewIcons: Record<DishView, ReactNode> = {
  list: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="3" width="4" height="4" rx="1" />
      <rect x="8" y="4" width="10" height="2" rx="1" />
      <rect x="2" y="9" width="4" height="4" rx="1" />
      <rect x="8" y="10" width="10" height="2" rx="1" />
      <rect x="2" y="15" width="4" height="3" rx="1" />
      <rect x="8" y="15.5" width="10" height="2" rx="1" />
    </svg>
  ),
  detailed: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="3" width="4" height="6" rx="1" />
      <rect x="7" y="4" width="3" height="1.6" rx="0.8" />
      <rect x="7" y="7" width="2" height="1.6" rx="0.8" />
      <rect x="11" y="3" width="4" height="6" rx="1" />
      <rect x="16" y="4" width="2.5" height="1.6" rx="0.8" />
      <rect x="2" y="11" width="4" height="6" rx="1" />
      <rect x="7" y="12" width="3" height="1.6" rx="0.8" />
      <rect x="11" y="11" width="4" height="6" rx="1" />
      <rect x="16" y="12" width="2.5" height="1.6" rx="0.8" />
    </svg>
  ),
  gallery: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="2" width="4.5" height="7" rx="1" />
      <rect x="7.75" y="2" width="4.5" height="7" rx="1" />
      <rect x="13.5" y="2" width="4.5" height="7" rx="1" />
      <rect x="2" y="11" width="4.5" height="7" rx="1" />
      <rect x="7.75" y="11" width="4.5" height="7" rx="1" />
      <rect x="13.5" y="11" width="4.5" height="7" rx="1" />
    </svg>
  ),
};

/** Three icon buttons; the pressed one is the layout on screen. */
export function DishViewSwitcher({
  view,
  onChange,
}: {
  view: DishView;
  onChange: (view: DishView) => void;
}) {
  return (
    <div className="dish-view-switcher" role="group" aria-label="Kiểu hiển thị">
      {dishViews.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          title={option.label}
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
          suppressHydrationWarning
        >
          {viewIcons[option.value]}
        </button>
      ))}
    </div>
  );
}

function LikeCount({ count }: { count: number }) {
  return (
    <span className="dish-likes" aria-label={`${count} lượt thích`}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 17.2 3.6 10.9a4.1 4.1 0 0 1 5.8-5.8l.6.6.6-.6a4.1 4.1 0 1 1 5.8 5.8Z" />
      </svg>
      <span aria-hidden="true">{count.toLocaleString("vi-VN")}</span>
    </span>
  );
}

/** Dish form first, then its tags: the type line under the name. */
function DishKinds({ dish }: { dish: DishCardDto }) {
  return (
    <p className="dish-kinds">
      <span className="dish-kind">{dishFormLabels[dish.dishForm]}</span>
      {dish.tags.map((tag) => (
        <span key={tag.id} className="dish-tag">
          {tag.name}
        </span>
      ))}
      {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
    </p>
  );
}

function DishPlace({ dish }: { dish: DishCardDto }) {
  const place = locationText(
    dish.restaurant.district,
    dish.restaurant.provinceName,
  );
  return (
    <p className="dish-place">
      <strong className="dish-price">{vnd(dish.price)}</strong>
      <span>
        {dish.restaurant.name}
        {place && ` · ${place}`}
      </span>
    </p>
  );
}

/** Descriptions longer than this get "Đọc thêm"; shorter ones are shown whole. */
const longDescription = { list: 160, detailed: 240 } as const;

function DescriptionText({
  dishId,
  description,
  size,
  onRetry,
}: {
  dishId: number;
  description: DishDescription;
  size: keyof typeof longDescription;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (description.status === "loading")
    return (
      <p className="dish-description is-loading" aria-busy="true">
        <span className="sr-only">Đang tải mô tả…</span>
      </p>
    );
  if (description.status === "error")
    return (
      <p className="dish-description is-muted">
        Chưa tải được mô tả.{" "}
        <button type="button" className="dish-text-button" onClick={onRetry}>
          Tải lại
        </button>
      </p>
    );
  if (!description.text)
    return <p className="dish-description is-muted">Món này chưa có mô tả.</p>;
  const long = description.text.length > longDescription[size];
  const id = `dish-description-${dishId}`;
  return (
    <div className="dish-description-block">
      <p
        id={id}
        className={`dish-description${long && !open ? ` is-clamped-${size}` : ""}`}
      >
        {description.text}
      </p>
      {long && (
        <button
          type="button"
          className="dish-text-button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Thu gọn" : "Đọc thêm"}
        </button>
      )}
    </div>
  );
}

function DishName({ dish }: { dish: DishCardDto }) {
  return (
    <h3 id={`dish-${dish.id}`} className="dish-name">
      <Link href={dishHref(dish.id)}>{dish.name}</Link>
    </h3>
  );
}

/** Mode 1: one dish per row across the width, a small photo on the left. */
export function DishRow({
  dish,
  description,
  onRetry,
}: {
  dish: DishCardDto;
  description: DishDescription;
  onRetry: () => void;
}) {
  return (
    <article className="dish-item dish-row" aria-labelledby={`dish-${dish.id}`}>
      <Media
        className="dish-thumb"
        src={dish.coverUrl ?? undefined}
        alt={dish.name}
      />
      <div className="dish-body">
        <div className="dish-head">
          <DishName dish={dish} />
          <LikeCount count={dish.likeCount} />
        </div>
        <DishKinds dish={dish} />
        <DescriptionText
          dishId={dish.id}
          description={description}
          size="list"
          onRetry={onRetry}
        />
        <DishPlace dish={dish} />
      </div>
    </article>
  );
}

/** Mode 2: two cards a row, a large photo on the left and every detail beside it. */
export function DishDetailCard({
  dish,
  description,
  onRetry,
}: {
  dish: DishCardDto;
  description: DishDescription;
  onRetry: () => void;
}) {
  return (
    <article
      className="dish-item dish-detail"
      aria-labelledby={`dish-${dish.id}`}
    >
      <Media
        className="dish-photo"
        src={dish.coverUrl ?? undefined}
        alt={dish.name}
      />
      <div className="dish-body">
        <div className="dish-head">
          <DishName dish={dish} />
          <LikeCount count={dish.likeCount} />
        </div>
        <DishKinds dish={dish} />
        <DescriptionText
          dishId={dish.id}
          description={description}
          size="detailed"
          onRetry={onRetry}
        />
        <DishPlace dish={dish} />
      </div>
    </article>
  );
}

/** Mode 3: only the photo, with the name on it. */
export function DishTile({ dish }: { dish: DishCardDto }) {
  return (
    <article
      className="dish-item dish-tile"
      aria-labelledby={`dish-${dish.id}`}
    >
      <Media
        className="dish-tile-photo"
        src={dish.coverUrl ?? undefined}
        alt=""
      />
      <DishName dish={dish} />
    </article>
  );
}
