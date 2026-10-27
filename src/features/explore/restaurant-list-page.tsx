"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Input } from "@/shared/ui";
import {
  Choice,
  EmptyState,
  Pagination,
  SelectField,
  Skeleton,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { PageHeading } from "@/components/layout/page-heading";
import { getErrorMessage } from "@/shared/api/error";
import { RestaurantCard } from "./explore-cards";
import {
  priceLevelOptions,
  ratingFilterOptions,
  restaurantApiQuery,
  restaurantFiltersHref,
  restaurantQueryFromParams,
  restaurantSortOptions,
  type RestaurantFilters,
} from "./explore-rules";
import { exploreService, type ExploreService } from "./explore-service";
import type { RestaurantSort } from "./explore-types";
import { useRemote } from "./use-remote";
import "./explore.css";

const noFilters: RestaurantFilters = {
  q: "",
  province: "",
  priceLevel: "",
  minRating: "",
  openNow: false,
  sort: "rating",
  page: 1,
};

function RestaurantFilterForm({
  initial,
  onApply,
}: {
  initial: RestaurantFilters;
  onApply: (filters: RestaurantFilters) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const hasFilter =
    JSON.stringify({ ...initial, page: 1 }) !== JSON.stringify(noFilters);
  return (
    <form
      className="card explore-filters"
      role="search"
      aria-label="Tìm quán ăn"
      onSubmit={(event) => {
        event.preventDefault();
        onApply({ ...draft, page: 1 });
      }}
    >
      <div className="explore-filter-row">
        <div className="field">
          <label htmlFor="restaurant-search">Tìm theo tên quán</label>
          <Input
            id="restaurant-search"
            type="search"
            value={draft.q}
            placeholder="Ví dụ: Bún Bò Bà Diệu"
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
          label="Mức giá"
          value={draft.priceLevel}
          options={priceLevelOptions}
          onChange={(value) => setDraft({ ...draft, priceLevel: value })}
        />
        <SelectField
          label="Đánh giá"
          value={draft.minRating}
          options={ratingFilterOptions}
          onChange={(value) => setDraft({ ...draft, minRating: value })}
        />
        <SelectField
          label="Sắp xếp"
          value={draft.sort}
          options={restaurantSortOptions}
          onChange={(value) =>
            setDraft({ ...draft, sort: value as RestaurantSort })
          }
        />
      </div>
      <Choice
        label="Chỉ quán đang mở cửa"
        checked={draft.openNow}
        onChange={(checked) => setDraft({ ...draft, openNow: checked })}
      />
      <div className="actions">
        <Button type="submit">Tìm quán</Button>
        {hasFilter && (
          <Button variant="tertiary" onClick={() => onApply(noFilters)}>
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </form>
  );
}

/** F-14 Browse Restaurant: REST-01, one page per URL (`/restaurants?page=2`). */
export function RestaurantListPage({
  service = exploreService,
}: {
  service?: ExploreService;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.toString();
  const filters = useMemo(() => restaurantQueryFromParams(params), [params]);
  const [state, retry] = useRemote(
    () => service.browseRestaurants(restaurantApiQuery(filters)),
    key,
  );
  // A bookmarked page past the end falls back to the last page.
  const lastPage =
    state.status === "ready" &&
    !state.data.items.length &&
    state.data.totalPages > 0 &&
    filters.page > state.data.totalPages
      ? state.data.totalPages
      : null;
  useEffect(() => {
    if (lastPage)
      router.replace(restaurantFiltersHref({ ...filters, page: lastPage }));
  }, [lastPage, router, filters]);
  const apply = (next: RestaurantFilters) =>
    router.push(restaurantFiltersHref(next));

  const heading = (
    <PageHeading
      eyebrow="Khám phá"
      title="Khám phá quán ăn"
      description="Tìm quán theo tên, khu vực, mức giá và đánh giá của thực khách."
    />
  );
  const form = (
    <RestaurantFilterForm key={key} initial={filters} onApply={apply} />
  );

  if (state.status === "loading" || lastPage)
    return (
      <div className="stack">
        {heading}
        {form}
        <Skeleton rows={4} />
      </div>
    );
  if (state.status === "error")
    return (
      <div className="stack">
        {heading}
        {form}
        <Card title="Chưa tải được danh sách quán">
          <Alert>{getErrorMessage(state.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      </div>
    );

  const { data } = state;
  return (
    <div className="stack">
      {heading}
      {form}
      {data.totalItems === 0 ? (
        <EmptyState title="Không tìm thấy quán phù hợp">
          Thử từ khóa, tỉnh thành hoặc bộ lọc khác.
        </EmptyState>
      ) : (
        <>
          <p className="helper" role="status">
            {data.totalItems} quán
          </p>
          <ul className="explore-grid">
            {data.items.map((restaurant) => (
              <li key={restaurant.id}>
                <RestaurantCard restaurant={restaurant} />
              </li>
            ))}
          </ul>
        </>
      )}
      {data.totalPages > 1 && (
        <Pagination
          total={data.totalItems}
          page={data.page}
          size={data.pageSize}
          onChange={(next) =>
            router.push(restaurantFiltersHref({ ...filters, page: next }))
          }
        />
      )}
    </div>
  );
}
