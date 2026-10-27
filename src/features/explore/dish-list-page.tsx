"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Input } from "@/shared/ui";
import { EmptyState, SelectField, Skeleton } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { PageHeading } from "@/components/layout/page-heading";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { DishCard } from "./explore-cards";
import {
  dishApiQuery,
  dishFiltersHref,
  dishFormOptions,
  dishPriceOptions,
  dishQueryFromParams,
} from "./explore-rules";
import { exploreService, type ExploreService } from "./explore-service";
import type { DishCardDto, DishForm, TagDto } from "./explore-types";
import { useRemote } from "./use-remote";
import "./explore.css";

type Filters = ReturnType<typeof dishQueryFromParams>;

const noFilters: Filters = {
  q: "",
  province: "",
  form: "",
  maxPrice: "",
  tagIds: [],
};

function DishFilters({
  initial,
  tags,
  onApply,
}: {
  initial: Filters;
  tags: TagDto[];
  onApply: (filters: Filters) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const hasFilter = JSON.stringify(initial) !== JSON.stringify(noFilters);
  return (
    <form
      className="card explore-filters"
      role="search"
      aria-label="Tìm món ăn"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="explore-filter-row">
        <div className="field">
          <label htmlFor="dish-search">Tìm món ăn</label>
          <Input
            id="dish-search"
            type="search"
            value={draft.q}
            placeholder="Ví dụ: bún bò, phở, cà phê…"
            autoComplete="off"
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
        </div>
        <ProvinceField
          label="Tỉnh / thành phố"
          type="search"
          value={draft.province}
          showCatalogStatus={false}
          autoComplete="off"
          onChange={(value) => setDraft({ ...draft, province: value })}
        />
        <SelectField
          label="Loại món"
          value={draft.form}
          options={dishFormOptions}
          onChange={(value) =>
            setDraft({ ...draft, form: value as "" | DishForm })
          }
        />
        <SelectField
          label="Mức giá"
          value={draft.maxPrice}
          options={dishPriceOptions}
          onChange={(value) => setDraft({ ...draft, maxPrice: value })}
        />
      </div>
      {tags.length > 0 && (
        <fieldset className="explore-tags">
          <legend>Thẻ món</legend>
          <div className="explore-chip-row">
            {tags.map((tag) => {
              const selected = draft.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`chip ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      tagIds: selected
                        ? draft.tagIds.filter((id) => id !== tag.id)
                        : [...draft.tagIds, tag.id],
                    })
                  }
                  suppressHydrationWarning
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="actions">
        <Button type="submit">Tìm món</Button>
        {hasFilter && (
          <Button variant="tertiary" onClick={() => onApply(noFilters)}>
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </form>
  );
}

/** F-12 Browse Dish: DISH-01 with the filters in the URL and the next page on request (`cursor`). */
export function DishListPage({
  service = exploreService,
}: {
  service?: ExploreService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.toString();
  const filters = useMemo(() => dishQueryFromParams(params), [params]);
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
  const apply = (next: Filters) => router.push(dishFiltersHref(next));

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
  const filtersForm = (
    <DishFilters
      key={key}
      initial={filters}
      tags={tags.status === "ready" ? tags.data : []}
      onApply={apply}
    />
  );

  if (first.status === "loading")
    return (
      <div className="stack">
        {heading}
        {filtersForm}
        <Skeleton rows={4} />
      </div>
    );
  if (first.status === "error")
    return (
      <div className="stack">
        {heading}
        {filtersForm}
        <Card title="Chưa tải được danh sách món">
          <Alert>{getErrorMessage(first.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      </div>
    );

  const items = [...first.data.items, ...(extra?.items ?? [])];
  const next = extra ? extra.next : first.data.nextCursor;
  return (
    <div className="stack">
      {heading}
      {filtersForm}
      {items.length === 0 ? (
        <EmptyState title="Không tìm thấy món phù hợp">
          Thử từ khóa, tỉnh thành hoặc bộ lọc khác.
        </EmptyState>
      ) : (
        <>
          <p className="helper" role="status">
            {items.length} món{next ? " (còn nữa)" : ""}
          </p>
          <ul className="explore-grid">
            {items.map((dish) => (
              <li key={dish.id}>
                <DishCard dish={dish} />
              </li>
            ))}
          </ul>
        </>
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
    </div>
  );
}
