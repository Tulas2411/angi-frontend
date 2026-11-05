"use client";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import { EmptyState, SelectField, Skeleton } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
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
import {
  BrowseHeading,
  BrowseLayout,
  BrowseSearchBar,
  FilterSidebar,
  useInstantFilters,
} from "./explore-browse";
import "./explore.css";

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

type DishFilterState = ReturnType<typeof useInstantFilters<DishFilters>>;

/** The dish filters inside the shared sidebar: place, form, prices, then the tag groups. */
function DishFilterFields({
  filters,
  tags,
}: {
  filters: DishFilterState;
  tags: TagDto[];
}) {
  const { draft, change } = filters;
  const byType = (type: TagDto["tagType"]) =>
    tags.filter((tag) => tag.tagType === type);
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
          label="Loại món"
          value={draft.form}
          options={dishFormOptions}
          onChange={(value) => change({ form: value as "" | DishForm }, "now")}
        />
        {/* One part of the sidebar: the two prices share its rule. */}
        <div className="dish-filter-pair">
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
          Trong một nhóm thẻ, món chỉ cần khớp một thẻ; giữa các nhóm phải khớp
          đủ.
        </p>
      </div>
    </>
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
    <BrowseHeading
      title="Khám phá món ăn"
      section="Món ăn"
      description="Tìm món hợp khẩu vị, xem quán bán món và thêm vào lộ trình của bạn."
    />
  );
  // The shared Yelp-like layout (explore-browse.tsx): filters applied as they are picked.
  const dishFilters = useInstantFilters(filters, apply, {
    href: dishFiltersHref,
    empty: emptyDishFilters,
    problem: (next) => dishPriceProblem(next) ?? "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();
  const count = activeDishFilterCount(filters);
  const layout = (results: ReactNode) => (
    <BrowseLayout
      heading={heading}
      search={
        <BrowseSearchBar
          label="Tìm món ăn"
          inputId="dish-search"
          submitLabel="Tìm món"
          placeholder="Tìm món hoặc quán: bún bò, phở, bánh xèo…"
          value={dishFilters.draft.q}
          onChange={(q) => dishFilters.change({ q }, "draft")}
          onSubmit={() => {
            // A refused price range is explained in the filters: show them.
            if (!dishFilters.submitSearch()) setFiltersOpen(true);
          }}
          count={count}
          open={filtersOpen}
          panelId={panelId}
          onToggle={() => setFiltersOpen((value) => !value)}
        />
      }
      sidebar={
        <FilterSidebar
          label="Bộ lọc món ăn"
          open={filtersOpen}
          panelId={panelId}
          count={count}
          canReset={!dishFilters.pristine || count > 0}
          onReset={dishFilters.reset}
          problem={dishFilters.problem}
        >
          <DishFilterFields
            filters={dishFilters}
            tags={tags.status === "ready" ? tags.data : []}
          />
        </FilterSidebar>
      }
    >
      {results}
    </BrowseLayout>
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
