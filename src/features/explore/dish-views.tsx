"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { dishHref } from "./explore-routes";
import { dishFormLabels, locationText, vnd } from "./explore-rules";
import type { MenuDishDto } from "./explore-types";
import { dishViews, type DishView } from "./dish-view-mode";
import type { DishDescription } from "./use-dish-descriptions";
import { cutDescription } from "./description-cut";

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
 * Where a long text is cut, measured on the real card: a hidden twin of the paragraph is filled
 * word by word. Measured again when the card changes width. `undefined` until measured.
 */
function useDescriptionCut(text: string) {
  const box = useRef<HTMLParagraphElement>(null);
  const twin = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState<{ text: string; at: number | null }>();
  useLayoutEffect(() => {
    const paragraph = box.current;
    const measure = twin.current;
    if (!paragraph || !measure) return;
    const words = text.split(/\s+/).filter(Boolean);
    const run = () => {
      const lineHeight = parseFloat(getComputedStyle(measure).lineHeight) || 22;
      measure.style.width = `${paragraph.clientWidth}px`;
      const fits = (count: number, lines: number, ellipsis: boolean) => {
        measure.textContent =
          words.slice(0, count).join(" ") + (ellipsis ? " …" : "");
        return measure.offsetHeight <= lines * lineHeight + 1;
      };
      const at = cutDescription(words.length, fits);
      measure.textContent = "";
      setCut((previous) =>
        previous?.text === text && previous.at === at ? previous : { text, at },
      );
    };
    run();
    const observer = new ResizeObserver(run);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [text]);
  const measured = cut?.text === text ? cut.at : undefined;
  return { box, twin, at: measured };
}

/**
 * Two lines and about seven words of the third, then "…": pressing it shows the whole text in the
 * card. Before the first measure the text is clamped to three lines, so nothing jumps.
 */
function LongDescription({ id, text }: { id: string; text: string }) {
  const { box, twin, at } = useDescriptionCut(text);
  const [open, setOpen] = useState(false);
  const cut = !open && typeof at === "number";
  const shown = cut
    ? text.split(/\s+/).filter(Boolean).slice(0, at).join(" ")
    : text;
  return (
    <div className="dish-description-wrap">
      <p
        ref={box}
        id={id}
        className={`dish-description${at === undefined && !open ? " is-measuring" : ""}`}
        data-expanded={open || undefined}
      >
        {shown}
        {cut && (
          <>
            {" "}
            <button
              type="button"
              className="dish-more"
              aria-expanded={false}
              aria-controls={id}
              aria-label="Xem toàn bộ mô tả"
              title="Xem toàn bộ mô tả"
              onClick={() => setOpen(true)}
            >
              …
            </button>
          </>
        )}
      </p>
      <p
        ref={twin}
        className="dish-description dish-description-twin"
        aria-hidden
      />
    </div>
  );
}

/**
 * The description of a list card (dish or restaurant): a placeholder while it loads, a retry when
 * it failed, `emptyText` when there is none, else the cut text. `id` names the paragraph.
 */
export function DescriptionText({
  id,
  description,
  onRetry,
  emptyText = "Món này chưa có mô tả.",
}: {
  id: string;
  description: DishDescription;
  onRetry: () => void;
  emptyText?: string;
}) {
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
    return <p className="dish-description is-muted">{emptyText}</p>;
  return <LongDescription id={id} text={description.text} />;
}

/** The dish name, a link to its page; `newTab` keeps a dialog the dish was shown in open. */
function DishName({ dish, newTab }: { dish: MenuDishDto; newTab?: boolean }) {
  return (
    <h3 id={`dish-${dish.id}`} className="dish-name">
      <Link
        href={dishHref(dish.id)}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {dish.name}
      </Link>
    </h3>
  );
}

/** What a list using the cards adds to each one (e.g. "Thêm vào bữa" in the roadmap dialog). */
interface CardExtras {
  /** Shown under the card's details. */
  actions?: ReactNode;
  /** Open the dish page in a new tab. */
  newTab?: boolean;
}

/** Mode 1: one dish per row across the width, a small photo on the left. */
export function DishRow({
  dish,
  description,
  onRetry,
  actions,
  newTab,
}: {
  dish: MenuDishDto;
  /** Left out where a list shows no descriptions (the roadmap dialog). */
  description?: DishDescription;
  onRetry?: () => void;
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
          <DishName dish={dish} newTab={newTab} />
          <LikeCount count={dish.likeCount} />
        </div>
        <DishKinds dish={dish} />
        {description && (
          <DescriptionText
            id={`dish-description-${dish.id}`}
            description={description}
            onRetry={onRetry ?? (() => undefined)}
          />
        )}
        <DishPlace dish={dish} />
        {actions && <div className="dish-actions">{actions}</div>}
      </div>
    </article>
  );
}

/** Mode 2: two cards a row, a large photo on the left and every detail beside it. */
export function DishDetailCard({
  dish,
  description,
  onRetry,
  actions,
  newTab,
}: {
  dish: MenuDishDto;
  /** Left out where a list shows no descriptions (the roadmap dialog). */
  description?: DishDescription;
  onRetry?: () => void;
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
          <DishName dish={dish} newTab={newTab} />
          <LikeCount count={dish.likeCount} />
        </div>
        <DishKinds dish={dish} />
        {description && (
          <DescriptionText
            id={`dish-description-${dish.id}`}
            description={description}
            onRetry={onRetry ?? (() => undefined)}
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
      <DishName dish={dish} newTab={newTab} />
      {actions && (
        <div className="dish-actions dish-tile-actions">{actions}</div>
      )}
    </article>
  );
}
