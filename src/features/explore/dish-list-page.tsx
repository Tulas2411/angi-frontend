"use client";
import { useId, useMemo, useState, type ReactNode } from "react";
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

/**
 * The filters being chosen (the draft) next to the applied ones in the URL. The search bar and
 * the sidebar edit the same draft, so either one applies everything chosen so far. A new search
 * in the URL (applied here, or by back/forward) becomes the draft.
 */
function useDishDraft(applied: DishFilters, onApply: (f: DishFilters) => void) {
  const [draft, setDraft] = useState(applied);
  const [problem, setProblem] = useState("");
  const appliedKey = JSON.stringify(applied);
  const [seen, setSeen] = useState(appliedKey);
  if (seen !== appliedKey) {
    setSeen(appliedKey);
    setDraft(applied);
  }
  const set = (next: Partial<DishFilters>) => {
    setProblem("");
    setDraft((current) => ({ ...current, ...next }));
  };
  /** Applies the draft; false when the price range cannot match (the reason is in `problem`). */
  function submit() {
    const price = dishPriceProblem(draft);
    if (price) {
      setProblem(price);
      return false;
    }
    onApply(draft);
    return true;
  }
  function reset() {
    setDraft(emptyDishFilters);
    setProblem("");
    onApply(emptyDishFilters);
  }
  return { draft, set, problem, submit, reset };
}
type DishDraft = ReturnType<typeof useDishDraft>;

/**
 * The search bar above the results. On narrow screens it also holds the button that shows the
 * filters (on wide screens they are always in the sidebar and the button is hidden).
 */
function DishSearchBar({
  form,
  applied,
  open,
  panelId,
  onToggle,
  onRefused,
}: {
  form: DishDraft;
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
        if (!form.submit()) onRefused();
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
            value={form.draft.q}
            placeholder="Tìm món hoặc quán: bún bò, phở, bánh xèo…"
            autoComplete="off"
            onChange={(event) => form.set({ q: event.target.value })}
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
 * The filters. On wide screens a sidebar left of the results, always shown and following the
 * page as it scrolls; on narrow screens the panel the search bar's button slides down (`hidden`
 * applies once it has slid up). Choices are kept until applied; applied filters live in the URL.
 */
function DishFilterSidebar({
  form,
  applied,
  tags,
  open,
  panelId,
}: {
  form: DishDraft;
  applied: DishFilters;
  tags: TagDto[];
  open: boolean;
  panelId: string;
}) {
  const { draft, set, problem } = form;
  const count = activeDishFilterCount(applied);
  const changed = !sameFilters(draft, applied);
  const byType = (type: TagDto["tagType"]) =>
    tags.filter((tag) => tag.tagType === type);
  return (
    <div className="dish-filter-collapse dish-filter-sidebar" hidden={!open}>
      <div>
        <form
          id={panelId}
          className="dish-filter-panel"
          aria-label="Bộ lọc món ăn"
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
        >
          <div className="dish-filter-head">
            <h2>Bộ lọc</h2>
            {count > 0 && (
              <span className="dish-filter-count" aria-hidden>
                {count}
              </span>
            )}
          </div>
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
              label="Loại món"
              value={draft.form}
              options={dishFormOptions}
              onChange={(value) => set({ form: value as "" | DishForm })}
            />
            <SelectField
              label="Giá từ"
              value={draft.minPrice}
              options={dishMinPriceOptions}
              onChange={(value) => set({ minPrice: value })}
            />
            <SelectField
              label="Giá đến"
              value={draft.maxPrice}
              options={dishPriceOptions}
              onChange={(value) => set({ maxPrice: value })}
            />
          </div>
          <div className="dish-filter-groups">
            <TagChips
              legend="Bữa ăn"
              tags={byType("meal_time")}
              ids={draft.tagIds}
              onChange={(tagIds) => set({ tagIds })}
            />
            <TagChips
              legend="Phân loại"
              tags={byType("category")}
              ids={draft.tagIds}
              onChange={(tagIds) => set({ tagIds })}
            />
            <TagChips
              legend="Chế độ ăn"
              tags={byType("dietary")}
              ids={draft.tagIds}
              onChange={(tagIds) => set({ tagIds })}
            />
            <TagChips
              legend="Không ăn (bỏ món có thẻ)"
              tags={[...byType("dietary"), ...byType("category")]}
              ids={draft.excludeTagIds}
              onChange={(excludeTagIds) => set({ excludeTagIds })}
            />
          </div>
          {problem && <Alert>{problem}</Alert>}
          {/* Stays at the bottom of the sidebar while its groups scroll. */}
          <div className="dish-filter-actions">
            <p className="helper" aria-live="polite">
              {changed
                ? "Có thay đổi chưa áp dụng."
                : "Trong một nhóm thẻ, món chỉ cần khớp một thẻ; giữa các nhóm phải khớp đủ."}
            </p>
            <div className="actions">
              <Button
                variant="tertiary"
                disabled={sameFilters(draft, emptyDishFilters) && count === 0}
                onClick={form.reset}
              >
                Đặt lại bộ lọc
              </Button>
              <Button type="submit">Áp dụng bộ lọc</Button>
            </div>
          </div>
        </form>
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
  const apply = (next: DishFilters) => router.push(dishFiltersHref(next));

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
  // Filters: a sidebar beside the results on wide screens; a panel under the search bar,
  // shown by its button, on narrow ones (where `filtersOpen` matters).
  const form = useDishDraft(filters, apply);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();
  const layout = (results: ReactNode) => (
    <div className="stack">
      {heading}
      <div className="dish-browse">
        <DishSearchBar
          form={form}
          applied={filters}
          open={filtersOpen}
          panelId={panelId}
          onToggle={() => setFiltersOpen((value) => !value)}
          onRefused={() => setFiltersOpen(true)}
        />
        <DishFilterSidebar
          form={form}
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
