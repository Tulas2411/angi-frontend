"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Input } from "@/shared/ui";
import {
  Choice,
  EmptyState,
  SelectField,
  Skeleton,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { PageHeading } from "@/components/layout/page-heading";
import { getErrorMessage } from "@/shared/api/error";
import {
  activeRestaurantFilterCount,
  appendRestaurants,
  emptyRestaurantFilters,
  priceLevelOptions,
  ratingFilterOptions,
  restaurantApiQuery,
  restaurantFiltersHref,
  restaurantQueryFromParams,
  restaurantSortOptions,
  type RestaurantFilters,
} from "./explore-rules";
import { exploreService, type ExploreService } from "./explore-service";
import type { RestaurantCardDto, RestaurantSort } from "./explore-types";
import { useRestaurantView } from "./dish-view-mode";
import { DishViewSwitcher } from "./dish-views";
import {
  RestaurantDetailCard,
  RestaurantRow,
  RestaurantTile,
} from "./restaurant-views";
import { useRestaurantDescriptions } from "./use-dish-descriptions";
import { useRemote } from "./use-remote";
import "./explore.css";

const sameFilters = (a: RestaurantFilters, b: RestaurantFilters) =>
  JSON.stringify(a) === JSON.stringify(b);

/** How far below the screen the next page starts loading, so the traveler rarely waits. */
const preloadMargin = "600px";

/**
 * The search row with its expandable filter panel, as on the dish list. The panel only hides when
 * collapsed, so a choice not applied yet survives; applied filters live in the URL.
 */
function RestaurantSearch({
  applied,
  onApply,
}: {
  applied: RestaurantFilters;
  onApply: (filters: RestaurantFilters) => void;
}) {
  const [draft, setDraft] = useState(applied);
  const [open, setOpen] = useState(false);
  // A new search in the URL (applied here, or by back/forward) becomes the draft.
  const appliedKey = JSON.stringify(applied);
  const [seen, setSeen] = useState(appliedKey);
  if (seen !== appliedKey) {
    setSeen(appliedKey);
    setDraft(applied);
  }
  const panelId = useId();
  const count = activeRestaurantFilterCount(applied);
  const changed = !sameFilters(draft, applied);
  const set = (next: Partial<RestaurantFilters>) =>
    setDraft((current) => ({ ...current, ...next }));

  return (
    <form
      className="dish-search"
      role="search"
      aria-label="Tìm quán ăn"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="dish-search-row">
        <div className="dish-search-box">
          <button
            type="submit"
            className="dish-search-submit"
            aria-label="Tìm quán"
            title="Tìm quán"
            suppressHydrationWarning
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
          </button>
          <Input
            id="restaurant-search"
            type="search"
            aria-label="Tìm quán ăn"
            value={draft.q}
            placeholder="Tìm quán theo tên: Bún Bò Bà Diệu, Phở Thìn…"
            autoComplete="off"
            onChange={(event) => set({ q: event.target.value })}
          />
        </div>
        <button
          type="button"
          className="dish-filter-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          suppressHydrationWarning
        >
          <span>{open ? "Ẩn bộ lọc" : "Hiện bộ lọc"}</span>
          {count > 0 && (
            <span
              className="dish-filter-count"
              aria-label={`${count} bộ lọc đang dùng`}
            >
              {count}
            </span>
          )}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </button>
      </div>

      {/* Slides down when shown and back up when hidden; `hidden` applies once it has slid up. */}
      <div className="dish-filter-collapse" hidden={!open}>
        <div>
          <div id={panelId} className="dish-filter-panel">
            <div className="dish-filter-grid">
              <ProvinceField
                label="Tỉnh / thành phố"
                type="search"
                value={draft.province}
                showCatalogStatus={false}
                autoComplete="off"
                helper="Để trống để tìm ở mọi nơi."
                onChange={(value) => set({ province: value })}
              />
              <SelectField
                label="Mức giá"
                value={draft.priceLevel}
                options={priceLevelOptions}
                onChange={(value) => set({ priceLevel: value })}
              />
              <SelectField
                label="Đánh giá"
                value={draft.minRating}
                options={ratingFilterOptions}
                onChange={(value) => set({ minRating: value })}
              />
              <SelectField
                label="Sắp xếp"
                value={draft.sort}
                options={restaurantSortOptions}
                onChange={(value) => set({ sort: value as RestaurantSort })}
              />
            </div>
            <div className="dish-filter-groups">
              <Choice
                label="Chỉ quán đang mở cửa"
                checked={draft.openNow}
                onChange={(checked) => set({ openNow: checked })}
              />
            </div>
            <div className="dish-filter-actions">
              <p className="helper" aria-live="polite">
                {changed
                  ? "Có thay đổi chưa áp dụng."
                  : "Kết quả gồm các quán đã được ANGI xác minh."}
              </p>
              <div className="actions">
                <Button
                  variant="tertiary"
                  disabled={
                    sameFilters(draft, emptyRestaurantFilters) &&
                    sameFilters(applied, emptyRestaurantFilters)
                  }
                  onClick={() => {
                    setDraft(emptyRestaurantFilters);
                    onApply(emptyRestaurantFilters);
                  }}
                >
                  Đặt lại bộ lọc
                </Button>
                <Button type="submit">Áp dụng bộ lọc</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * F-14 Browse Restaurant: REST-01 with its filters kept in the URL, the same three layouts as the
 * dish list, and the next page loaded by itself when the end of the list comes near.
 */
export function RestaurantListPage({
  service = exploreService,
}: {
  service?: ExploreService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(() => restaurantQueryFromParams(params), [params]);
  // The page number of an old link is not part of the search.
  const key = restaurantFiltersHref(filters);
  const [view, setView] = useRestaurantView();
  const [first, retry] = useRemote(
    () => service.browseRestaurants(restaurantApiQuery(filters)),
    key,
  );
  /** Pages after the first, for the search they were loaded for. */
  const [more, setMore] = useState<{
    key: string;
    items: RestaurantCardDto[];
    page: number;
    totalPages: number;
  } | null>(null);
  const [moreState, setMoreState] = useState({
    key: "",
    loading: false,
    problem: "",
  });
  const loadingMore = useRef(false);
  const currentKey = useRef(key);
  useEffect(() => {
    currentKey.current = key;
  }, [key]);
  const sentinel = useRef<HTMLDivElement>(null);

  const extra = more && more.key === key ? more : null;
  const status = moreState.key === key ? moreState : null;
  const firstItems = first.status === "ready" ? first.data.items : [];
  const items = extra ? [...firstItems, ...extra.items] : firstItems;
  const loadedPage = extra?.page ?? 1;
  const totalPages =
    extra?.totalPages ?? (first.status === "ready" ? first.data.totalPages : 0);
  const hasNext = first.status === "ready" && loadedPage < totalPages;
  const { describe, retry: retryDescription } = useRestaurantDescriptions(
    service,
    items.map((restaurant) => restaurant.id),
    view !== "gallery",
  );
  const apply = (next: RestaurantFilters) =>
    router.push(restaurantFiltersHref(next));

  async function loadMore() {
    if (loadingMore.current || !hasNext) return;
    loadingMore.current = true;
    const forKey = key;
    const page = loadedPage + 1;
    setMoreState({ key: forKey, loading: true, problem: "" });
    try {
      const answer = await service.browseRestaurants(
        restaurantApiQuery(filters, page),
      );
      if (currentKey.current !== forKey) return;
      setMore({
        key: forKey,
        items: appendRestaurants(items, answer.items).slice(firstItems.length),
        page,
        totalPages: answer.totalPages,
      });
      setMoreState({ key: forKey, loading: false, problem: "" });
    } catch (caught) {
      if (currentKey.current === forKey)
        setMoreState({
          key: forKey,
          loading: false,
          problem: getErrorMessage(caught),
        });
    } finally {
      loadingMore.current = false;
    }
  }
  const load = useRef(loadMore);
  useEffect(() => {
    load.current = loadMore;
  });

  // Lazy loading: the next page is asked for when the end of the list nears the screen. A new
  // observer per loaded page also covers a short page that leaves the end in view.
  const stopped = Boolean(status?.problem) || Boolean(status?.loading);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNext || stopped) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load.current();
      },
      { rootMargin: `0px 0px ${preloadMargin} 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNext, stopped, loadedPage, key]);

  const heading = (
    <PageHeading
      eyebrow="Khám phá"
      title="Khám phá quán ăn"
      description="Tìm quán theo tên, khu vực, mức giá và đánh giá của thực khách."
    />
  );
  const search = <RestaurantSearch applied={filters} onApply={apply} />;

  if (first.status === "loading")
    return (
      <div className="stack">
        {heading}
        {search}
        <Skeleton rows={4} />
      </div>
    );
  if (first.status === "error")
    return (
      <div className="stack">
        {heading}
        {search}
        <Card title="Chưa tải được danh sách quán">
          <Alert>{getErrorMessage(first.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      </div>
    );

  const total = first.data.totalItems;
  return (
    <div className="stack">
      {heading}
      {search}
      {items.length === 0 ? (
        <EmptyState title="Không tìm thấy quán phù hợp">
          Thử từ khóa, tỉnh thành hoặc bộ lọc khác.
        </EmptyState>
      ) : (
        <section className="dish-results" aria-label="Kết quả tìm quán">
          <div className="dish-results-bar">
            <p className="helper" role="status">
              Đang hiện {items.length} / {total} quán ·{" "}
              {filters.sort === "newest"
                ? "quán mới lên ANGI trước"
                : "đánh giá cao trước"}
            </p>
            <DishViewSwitcher view={view} onChange={setView} />
          </div>
          <ul className={`dish-items dish-items-${view}`}>
            {items.map((restaurant) => (
              <li key={restaurant.id}>
                {view === "gallery" ? (
                  <RestaurantTile restaurant={restaurant} />
                ) : view === "list" ? (
                  <RestaurantRow
                    restaurant={restaurant}
                    description={describe(restaurant.id)}
                    onRetry={() => retryDescription(restaurant.id)}
                  />
                ) : (
                  <RestaurantDetailCard
                    restaurant={restaurant}
                    description={describe(restaurant.id)}
                    onRetry={() => retryDescription(restaurant.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div ref={sentinel} className="explore-lazy" aria-live="polite">
        {status?.loading && (
          <p className="helper explore-lazy-loading">
            <span className="spinner" aria-hidden /> Đang tải thêm quán…
          </p>
        )}
        {status?.problem && (
          <Alert>
            Chưa tải được thêm quán: {status.problem}{" "}
            <Button variant="secondary" onClick={() => void loadMore()}>
              Thử lại
            </Button>
          </Alert>
        )}
        {!hasNext && loadedPage > 1 && (
          <p className="helper">Đã hiện tất cả {items.length} quán.</p>
        )}
      </div>
    </div>
  );
}
