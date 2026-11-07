"use client";
import {
  PlanRoadmapBanner,
  type PlanBannerAudience,
} from "./plan-roadmap-banner";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  Choice,
  EmptyState,
  SelectField,
  Skeleton,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
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
import {
  BrowseHeading,
  BrowseLayout,
  BrowseSearchBar,
  FilterSidebar,
  useInstantFilters,
} from "./explore-browse";
import "./explore.css";

/** How far below the screen the next page starts loading, so the traveler rarely waits. */
const preloadMargin = "600px";

type RestaurantFilterState = ReturnType<
  typeof useInstantFilters<RestaurantFilters>
>;

/**
 * The restaurant filters inside the shared sidebar (explore-browse.tsx): place, price level,
 * rating, order, then "open now". Every pick applies at once; the place after a short pause.
 */
function RestaurantFilterFields({
  filters,
}: {
  filters: RestaurantFilterState;
}) {
  const { draft, change } = filters;
  return (
    <>
      <div className="dish-filter-grid">
        <ProvinceField
          label="Tỉnh / thành phố"
          type="search"
          placeholder="Ví dụ: Hà Nội"
          value={draft.province}
          showCatalogStatus={false}
          autoComplete="off"
          helper="Để trống để tìm ở mọi nơi."
          onChange={(value) => change({ province: value }, "typing")}
        />
        <SelectField
          label="Mức giá"
          value={draft.priceLevel}
          options={priceLevelOptions}
          onChange={(value) => change({ priceLevel: value }, "now")}
        />
        <SelectField
          label="Đánh giá"
          value={draft.minRating}
          options={ratingFilterOptions}
          onChange={(value) => change({ minRating: value }, "now")}
        />
        <SelectField
          label="Sắp xếp"
          value={draft.sort}
          options={restaurantSortOptions}
          onChange={(value) => change({ sort: value as RestaurantSort }, "now")}
        />
      </div>
      <div className="dish-filter-groups">
        <fieldset className="dish-filter-chips">
          <legend>Giờ mở cửa</legend>
          <Choice
            label="Chỉ quán đang mở cửa"
            checked={draft.openNow}
            onChange={(checked) => change({ openNow: checked }, "now")}
          />
        </fieldset>
        <p className="helper dish-filter-hint">
          Kết quả gồm các quán đã được ANGI xác minh.
        </p>
      </div>
    </>
  );
}

/**
 * F-14 Browse Restaurant: REST-01 with its filters kept in the URL, the same three layouts as the
 * dish list, and the next page loaded by itself when the end of the list comes near.
 */
export function RestaurantListPage({
  service = exploreService,
  planAudience = null,
}: {
  service?: ExploreService;
  /** Who is invited to plan a roadmap above the breadcrumb; null hides the banner. */
  planAudience?: PlanBannerAudience | null;
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
  // Each pick is a new URL (Back steps through the searches); the page keeps its scroll.
  const apply = (next: RestaurantFilters) =>
    router.push(restaurantFiltersHref(next), { scroll: false });

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
    <BrowseHeading
      banner={planAudience && <PlanRoadmapBanner audience={planAudience} />}
      title="Khám phá quán ăn"
      section="Quán ăn"
      description="Tìm quán theo tên, khu vực, mức giá và đánh giá của thực khách."
    />
  );
  // The shared Yelp-like layout (explore-browse.tsx): filters applied as they are picked.
  const restaurantFilters = useInstantFilters(filters, apply, {
    href: restaurantFiltersHref,
    empty: emptyRestaurantFilters,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();
  const count = activeRestaurantFilterCount(filters);
  const layout = (results: ReactNode) => (
    <BrowseLayout
      heading={heading}
      search={
        <BrowseSearchBar
          label="Tìm quán ăn"
          inputId="restaurant-search"
          submitLabel="Tìm quán"
          placeholder="Tìm quán theo tên: Bún Bò Bà Diệu, Phở Thìn…"
          value={restaurantFilters.draft.q}
          onChange={(q) => restaurantFilters.change({ q }, "draft")}
          onSubmit={() => restaurantFilters.submitSearch()}
          count={count}
          open={filtersOpen}
          panelId={panelId}
          onToggle={() => setFiltersOpen((value) => !value)}
        />
      }
      sidebar={
        <FilterSidebar
          label="Bộ lọc quán ăn"
          open={filtersOpen}
          panelId={panelId}
          count={count}
          canReset={!restaurantFilters.pristine || count > 0}
          onReset={restaurantFilters.reset}
          problem={restaurantFilters.problem}
        >
          <RestaurantFilterFields filters={restaurantFilters} />
        </FilterSidebar>
      }
    >
      {results}
    </BrowseLayout>
  );

  if (first.status === "loading") return layout(<Skeleton rows={4} />);
  if (first.status === "error")
    return layout(
      <Card title="Chưa tải được danh sách quán">
        <Alert>{getErrorMessage(first.error)}</Alert>
        <Button onClick={retry}>Thử lại</Button>
      </Card>,
    );

  const total = first.data.totalItems;
  return layout(
    <>
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
    </>,
  );
}
