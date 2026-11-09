"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { dishHref } from "./explore-routes";
import { dishFormLabels, locationText, vnd } from "./explore-rules";
import type { MenuDishDto } from "./explore-types";
import { dishViews, type DishView } from "./dish-view-mode";

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
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.5" />
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
function DishKinds({ dish }: { dish: MenuDishDto }) {
  return (
    <p className="dish-kinds">
      <span className="dish-kind">{dishFormLabels[dish.dishForm]}</span>
      {dish.tags
        .filter((tag) => tag.name !== dishFormLabels[dish.dishForm])
        .map((tag) => (
          <span key={tag.id} className="dish-tag">
            {tag.name}
          </span>
        ))}
      {!dish.isAvailable && <Badge tone="warning">Tạm hết món</Badge>}
    </p>
  );
}

/** The price, then the restaurant; a restaurant's own menu has no restaurant to name. */
function DishPlace({ dish }: { dish: MenuDishDto }) {
  const { restaurant } = dish;
  const place = restaurant
    ? locationText(restaurant.district, restaurant.provinceName)
    : "";
  return (
    <p className="dish-place">
      <strong className="dish-price">{vnd(dish.price)}</strong>
      {restaurant && (
        <span
          className="dish-place-name"
          title={place ? `${restaurant.name} · ${place}` : restaurant.name}
        >
          {restaurant.name}
          {place && ` · ${place}`}
        </span>
      )}
    </p>
  );
}

/**
 * The whole description in a box of fixed height: three lines in a row or a restaurant card, the
 * room left above the price in a detailed card. Longer text scrolls inside the box and fades out
 * at the bottom until its end is reached.
 */
function LongDescription({ id, text }: { id: string; text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ overflowing: false, atEnd: true });
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const update = () => {
      const overflowing = element.scrollHeight > element.clientHeight + 1;
      const atEnd =
        element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      setFit((previous) =>
        previous.overflowing === overflowing && previous.atEnd === atEnd
          ? previous
          : { overflowing, atEnd },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [text]);
  return (
    <div
      ref={box}
      className="dish-description-wrap"
      data-overflowing={fit.overflowing || undefined}
      data-faded={(fit.overflowing && !fit.atEnd) || undefined}
    >
      <p id={id} className="dish-description">
        {text}
      </p>
    </div>
  );
}

/**
 * The description of a list card (dish or restaurant), read from the card itself (DishCard,
 * RestaurantCard): `emptyText` when there is none, else the cut text. `id` names the paragraph.
 */
export function DescriptionText({
  id,
  text,
  emptyText = "Món này chưa có mô tả.",
}: {
  id: string;
  text: string | null | undefined;
  emptyText?: string;
}) {
  const shown = text?.trim();
  if (!shown) return <p className="dish-description is-muted">{emptyText}</p>;
  return <LongDescription id={id} text={shown} />;
}

/**
 * A card's name, a link to its page, at most `lines` lines: one in a card body, three on a
 * gallery photo. A longer name fades out at the end of its last line instead of ending in "…".
 * The fade masks the text, not the heading, so it works on the card and on the photo and leaves
 * the link over the card whole. `newTab` keeps a dialog the card was shown in open.
 */
export function CardName({
  id,
  href,
  name,
  lines,
  newTab,
}: {
  id: string;
  href: string;
  name: string;
  lines: 1 | 3;
  newTab?: boolean;
}) {
  const text = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const element = text.current;
    if (!element) return;
    const update = () =>
      setOverflowing(
        element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [name]);
  return (
    <h3
      id={id}
      className="dish-name card-name"
      data-lines={lines}
      title={overflowing ? name : undefined}
    >
      <Link
        href={href}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <span
          ref={text}
          className="card-name-text"
          data-overflowing={overflowing || undefined}
        >
          {name}
        </span>
      </Link>
    </h3>
  );
}

function DishName({
  dish,
  lines,
  newTab,
}: {
  dish: MenuDishDto;
  lines: 1 | 3;
  newTab?: boolean;
}) {
  return (
    <CardName
      id={`dish-${dish.id}`}
      href={dishHref(dish.id)}
      name={dish.name}
      lines={lines}
      newTab={newTab}
    />
  );
}

/** What a list using the cards adds to each one (e.g. "Thêm vào bữa" in the roadmap dialog). */
interface CardExtras {
  /** Shown under the card's details. */
  actions?: ReactNode;
  /** Open the dish page in a new tab. */
  newTab?: boolean;
}

/** Mode 1: one dish per row across the width, the photo filling its left edge. */
export function DishRow({
  dish,
  showDescription = false,
  actions,
  newTab,
  priceInHead = false,
}: {
  dish: MenuDishDto;
  /** The card's description under its kinds (the lists in "detailed" and "list" layouts). */
  showDescription?: boolean;
  /**
   * The price on the name's line and no restaurant line (the roadmap dialog, whose rows show the
   * description instead of the restaurant).
   */
  priceInHead?: boolean;
} & CardExtras) {
  return (
    <article className="dish-item dish-row" aria-labelledby={`dish-${dish.id}`}>
      <Media
        className="dish-thumb"
        src={dish.coverUrl ?? undefined}
        alt={dish.name}
      />
      <div className="dish-body">
        <div className="dish-head">
          <DishName dish={dish} lines={1} newTab={newTab} />
          {priceInHead && (
            <strong className="dish-price">{vnd(dish.price)}</strong>
          )}
          <LikeCount count={dish.likeCount} />
        </div>
        <DishKinds dish={dish} />
        {showDescription && (
          <DescriptionText
            id={`dish-description-${dish.id}`}
            text={dish.description}
          />
        )}
        {!priceInHead && <DishPlace dish={dish} />}
        {actions && <div className="dish-actions">{actions}</div>}
      </div>
    </article>
  );
}

/** Mode 2: two cards a row, a large photo on the left and every detail beside it. */
export function DishDetailCard({
  dish,
  showDescription = false,
  actions,
  newTab,
}: {
  dish: MenuDishDto;
  /** False where a list shows no descriptions. */
  showDescription?: boolean;
} & CardExtras) {
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
          <DishName dish={dish} lines={1} newTab={newTab} />
          <LikeCount count={dish.likeCount} />
        </div>
        <DishKinds dish={dish} />
        {showDescription && (
          <DescriptionText
            id={`dish-description-${dish.id}`}
            text={dish.description}
          />
        )}
        <DishPlace dish={dish} />
        {actions && <div className="dish-actions">{actions}</div>}
      </div>
    </article>
  );
}

/** Mode 3: only the photo, with the name on it. */
export function DishTile({
  dish,
  actions,
  newTab,
}: { dish: MenuDishDto } & CardExtras) {
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
      <DishName dish={dish} lines={3} newTab={newTab} />
      {actions && (
        <div className="dish-actions dish-tile-actions">{actions}</div>
      )}
    </article>
  );
}
