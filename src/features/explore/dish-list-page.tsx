"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Input } from "@/shared/ui";
import { EmptyState, SelectField, Skeleton } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { PageHeading } from "@/components/layout/page-heading";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import {
  activeDishFilterCount,
  dishApiQuery,
  dishFiltersHref,
  dishFormOptions,
  dishMinPriceOptions,
  dishPriceOptions,
  dishPriceProblem,
  dishQueryFromParams,
  emptyDishFilters,
  type DishFilters,
} from "./explore-rules";
import { exploreService, type ExploreService } from "./explore-service";
import type { DishCardDto, DishForm, TagDto } from "./explore-types";
import { useDishView } from "./dish-view-mode";
import {
  DishDetailCard,
  DishRow,
  DishTile,
  DishViewSwitcher,
} from "./dish-views";
import { useDishDescriptions } from "./use-dish-descriptions";
import { useRemote } from "./use-remote";
import "./explore.css";

const sameFilters = (a: DishFilters, b: DishFilters) =>
  JSON.stringify(a) === JSON.stringify(b);

/** A group of tag chips; `ids` is the list the chips toggle in. */
function TagChips({
  legend,
  tags,
  ids,
  onChange,
}: {
  legend: string;
  tags: TagDto[];
  ids: number[];
  onChange: (ids: number[]) => void;
}) {
  if (!tags.length) return null;
  return (
    <fieldset className="dish-filter-chips">
      <legend>{legend}</legend>
      <div className="explore-chip-row">
        {tags.map((tag) => {
          const selected = ids.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`chip ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? ids.filter((id) => id !== tag.id)
                    : [...ids, tag.id],
                )
              }
              suppressHydrationWarning
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type ChangeMode = "now" | "typing" | "draft";

/**
 * Filters applied as they are picked (no "Áp dụng" button). Chips and menus apply at once, the
 * province after 500 ms without typing, the search text on Enter. The URL keeps the applied
 * search; our own updates coming back from it do not reset what is being typed, while another
 * search (back/forward, a link) does. A price range that cannot match is not applied.
 */
function useDishFilters(
  applied: DishFilters,
  onApply: (filters: DishFilters) => void,
) {
  const [draft, setDraft] = useState(applied);
  const [problem, setProblem] = useState("");
  const appliedHref = dishFiltersHref(applied);
  const [sentHref, setSentHref] = useState(appliedHref);
  const [seenHref, setSeenHref] = useState(appliedHref);
  if (seenHref !== appliedHref) {
    setSeenHref(appliedHref);
    if (appliedHref !== sentHref) setDraft(applied);
  }
  // The newest draft for the delayed province search.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function commit(next: DishFilters) {
    const price = dishPriceProblem(next);
    if (price) {
      setProblem(price);
      return false;
    }
    setProblem("");
    const href = dishFiltersHref(next);
    if (href !== dishFiltersHref(applied)) {
      setSentHref(href);
      onApply(next);
    }
    return true;
  }
  function change(next: Partial<DishFilters>, mode: ChangeMode) {
    const merged = { ...latest.current, ...next };
    latest.current = merged;
    setDraft(merged);
    setProblem("");
    if (timer.current) clearTimeout(timer.current);
    if (mode === "now") commit(merged);
    else if (mode === "typing")
      timer.current = setTimeout(() => commit(latest.current), 500);
  }
  function submitSearch() {
    if (timer.current) clearTimeout(timer.current);
    return commit(latest.current);
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    latest.current = emptyDishFilters;
    setDraft(emptyDishFilters);
    commit(emptyDishFilters);
  }
  return { draft, change, problem, submitSearch, reset };
}
type DishFilterState = ReturnType<typeof useDishFilters>;

/**
 * The search bar above the results (Enter searches). On narrow screens it also holds the button
 * that shows the filters; on wide screens they are always in the sidebar.
 */
function DishSearchBar({
  filters,
  applied,
  open,
  panelId,
  onToggle,
  onRefused,
}: {
  filters: DishFilterState;
  applied: DishFilters;
  open: boolean;
  panelId: string;
  onToggle: () => void;
  /** The price range was refused: show the filters, where the reason is. */
  onRefused: () => void;
}) {
  const count = activeDishFilterCount(applied);
  return (
    <form
      className="dish-search"
      role="search"
      aria-label="Tìm món ăn"
      onSubmit={(event) => {
        event.preventDefault();
        if (!filters.submitSearch()) onRefused();
      }}
    >
      <div className="dish-search-row">
        <div className="dish-search-box">
          <button
            type="submit"
            className="dish-search-submit"
            aria-label="Tìm món"
            title="Tìm món"
            suppressHydrationWarning
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
          </button>
          <Input
            id="dish-search"
            type="search"
            aria-label="Tìm món ăn"
            value={filters.draft.q}
            placeholder="Tìm món hoặc quán: bún bò, phở, bánh xèo…"
            autoComplete="off"
            onChange={(event) =>
              filters.change({ q: event.target.value }, "draft")
            }
          />
        </div>
        <button
          type="button"
          className="dish-filter-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
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
    </form>
  );
}

/**
 * The filters. Wide screens: a sidebar flush with the left edge of the window, always shown,
 * following the page as it scrolls. Narrow screens: the panel the search bar's button slides
 * down. Every pick applies at once.
 */
function DishFilterSidebar({
  filters,
  applied,
  tags,
  open,
  panelId,
}: {
  filters: DishFilterState;
  applied: DishFilters;
  tags: TagDto[];
  open: boolean;
  panelId: string;
}) {
  const { draft, change, problem } = filters;
  const count = activeDishFilterCount(applied);
  const byType = (type: TagDto["tagType"]) =>
    tags.filter((tag) => tag.tagType === type);
  // Its height, for the "tall sticky" sidebar of wide screens (explore.css): taller than the
  // window, it scrolls with the page until its end shows, then stays.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      element.style.setProperty(
        "--sidebar-height",
        `${Math.ceil(element.offsetHeight)}px`,
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    // Not the `hidden` attribute: Tailwind's preflight forces `[hidden]` to display: none
    // !important, which would hide the sidebar on wide screens too. `data-closed` hides the
    // panel only below 1024px (explore.css).
    <div
      ref={box}
      className="dish-filter-collapse dish-filter-sidebar"
      data-closed={open ? undefined : ""}
    >
      <div>
        <aside
          id={panelId}
          className="dish-filter-panel"
          aria-label="Bộ lọc món ăn"
        >
          <div className="dish-filter-head">
            <h2>Bộ lọc</h2>
            {count > 0 && (
              <span className="dish-filter-count" aria-hidden>
                {count}
              </span>
            )}
            <Button
              variant="tertiary"
              className="dish-filter-reset"
              disabled={sameFilters(draft, emptyDishFilters) && count === 0}
              onClick={filters.reset}
            >
              Đặt lại bộ lọc
            </Button>
          </div>
          {problem && <Alert>{problem}</Alert>}
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
              label="Loại món"
              value={draft.form}
              options={dishFormOptions}
              onChange={(value) =>
                change({ form: value as "" | DishForm }, "now")
              }
            />
            <SelectField
              label="Giá từ"
              value={draft.minPrice}
              options={dishMinPriceOptions}
              onChange={(value) => change({ minPrice: value }, "now")}
            />
            <SelectField
              label="Giá đến"
              value={draft.maxPrice}
              options={dishPriceOptions}
              onChange={(value) => change({ maxPrice: value }, "now")}
            />
          </div>
          <div className="dish-filter-groups">
            <TagChips
              legend="Bữa ăn"
              tags={byType("meal_time")}
              ids={draft.tagIds}
              onChange={(tagIds) => change({ tagIds }, "now")}
            />
            <TagChips
              legend="Phân loại"
              tags={byType("category")}
              ids={draft.tagIds}
              onChange={(tagIds) => change({ tagIds }, "now")}
            />
            <TagChips
              legend="Chế độ ăn"
              tags={byType("dietary")}
              ids={draft.tagIds}
              onChange={(tagIds) => change({ tagIds }, "now")}
            />
            <TagChips
              legend="Không ăn (bỏ món có thẻ)"
              tags={[...byType("dietary"), ...byType("category")]}
              ids={draft.excludeTagIds}
              onChange={(excludeTagIds) => change({ excludeTagIds }, "now")}
            />
            <p className="helper dish-filter-hint">
              Trong một nhóm thẻ, món chỉ cần khớp một thẻ; giữa các nhóm phải
              khớp đủ.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * F-12 Browse Dish: DISH-01 with every filter it accepts, kept in the URL; the next page on
 * request (`cursor`); three layouts of the same results, the chosen one remembered.
 */
export function DishListPage({
  service = exploreService,
}: {
  service?: ExploreService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.toString();
  const filters = useMemo(() => dishQueryFromParams(params), [params]);
  const [view, setView] = useDishView();
  const [first, retry] = useRemote(
    () => service.browseDishes(dishApiQuery(filters)),
    key,
  );
  const [tags] = useRemote(() => service.tags(), "tags");
  const [more, setMore] = useState<{
    key: string;
    items: DishCardDto[];
    next: string | null;
  } | null>(null);
  const [moreState, setMoreState] = useState({ loading: false, problem: "" });

  const extra = more && more.key === key ? more : null;
  const items =
    first.status === "ready"
      ? [...first.data.items, ...(extra?.items ?? [])]
      : [];
  const { describe, retry: retryDescription } = useDishDescriptions(
    service,
    items.map((dish) => dish.id),
    view !== "gallery",
  );
  // Each pick is a new URL (Back steps through the searches); the page keeps its scroll.
  const apply = (next: DishFilters) =>
    router.push(dishFiltersHref(next), { scroll: false });

  async function loadMore(cursor: string) {
    setMoreState({ loading: true, problem: "" });
    try {
      const page = await service.browseDishes(dishApiQuery(filters, cursor));
      setMore({
        key,
        items: [...(extra?.items ?? []), ...page.items],
        next: page.nextCursor,
      });
      setMoreState({ loading: false, problem: "" });
    } catch (caught) {
      setMoreState({
        loading: false,
        problem:
          caught instanceof ApiError && caught.errorCode === "INVALID_CURSOR"
            ? "Danh sách đã thay đổi, hãy tìm lại từ đầu."
            : getErrorMessage(caught),
      });
    }
  }

  const heading = (
    <PageHeading
      eyebrow="Khám phá"
      title="Khám phá món ăn"
      description="Tìm món hợp khẩu vị, xem quán bán món và thêm vào lộ trình của bạn."
    />
  );
  // Wide screens: the filter sidebar flush with the left edge, then the heading, search bar and
  // results. Narrow screens: heading, search bar, the filter panel its button shows (where
  // `filtersOpen` matters), results.
  const dishFilters = useDishFilters(filters, apply);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();
  const layout = (results: ReactNode) => (
    <div className="dish-list-page">
      <div className="dish-browse">
        <div className="dish-browse-head">{heading}</div>
        <DishSearchBar
          filters={dishFilters}
          applied={filters}
          open={filtersOpen}
          panelId={panelId}
          onToggle={() => setFiltersOpen((value) => !value)}
          onRefused={() => setFiltersOpen(true)}
        />
        <DishFilterSidebar
          filters={dishFilters}
          applied={filters}
          tags={tags.status === "ready" ? tags.data : []}
          open={filtersOpen}
          panelId={panelId}
        />
        <div className="dish-browse-main stack">{results}</div>
      </div>
    </div>
  );

  if (first.status === "loading") return layout(<Skeleton rows={4} />);
  if (first.status === "error")
    return layout(
      <Card title="Chưa tải được danh sách món">
        <Alert>{getErrorMessage(first.error)}</Alert>
        <Button onClick={retry}>Thử lại</Button>
      </Card>,
    );

  const next = extra ? extra.next : first.data.nextCursor;
  return layout(
    <>
      {items.length === 0 ? (
        <EmptyState title="Không tìm thấy món phù hợp">
          Thử từ khóa, tỉnh thành hoặc bộ lọc khác.
        </EmptyState>
      ) : (
        <section className="dish-results" aria-label="Kết quả tìm món">
          <div className="dish-results-bar">
            <p className="helper" role="status">
              {items.length} món{next ? " (còn nữa)" : ""} · xếp theo mức độ phù
              hợp do ANGI gợi ý
            </p>
            <DishViewSwitcher view={view} onChange={setView} />
          </div>
          <ul className={`dish-items dish-items-${view}`}>
            {items.map((dish) => (
              <li key={dish.id}>
                {view === "gallery" ? (
                  <DishTile dish={dish} />
                ) : view === "list" ? (
                  <DishRow
                    dish={dish}
                    description={describe(dish.id)}
                    onRetry={() => retryDescription(dish.id)}
                  />
                ) : (
                  <DishDetailCard
                    dish={dish}
                    description={describe(dish.id)}
                    onRetry={() => retryDescription(dish.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {moreState.problem && <Alert>{moreState.problem}</Alert>}
      {next && (
        <div className="explore-more">
          <Button
            variant="secondary"
            loading={moreState.loading}
            onClick={() => void loadMore(next)}
          >
            Xem thêm món
          </Button>
        </div>
      )}
    </>,
  );
}
