"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Badge, Button } from "@/shared/ui";
import {
  Dialog,
  EmptyState,
  Field,
  Media,
  SelectField,
  Skeleton,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { loadProvinceCatalog } from "@/shared/locations/province-service";
import {
  addItemError,
  buildAddItemRequest,
  buildSuggestionsQuery,
  mealSlots,
  provinceFromText,
  suggestionsError,
  validateSuggestionFilters,
  type SuggestionFilters,
} from "./roadmap-add-item-rules";
import { rememberDestination } from "./roadmap-destination";
import { dayTitle, formatRating, mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import type { RoadmapItemService } from "./roadmap-service";
import type {
  DishCardDto,
  MealSlot,
  RoadmapDayDto,
  RoadmapSummaryDto,
} from "./roadmap-types";
import { VndField } from "./vnd-field";
import "./roadmap-add-item.css";

type ListState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      requestId: string;
      items: DishCardDto[];
      nextCursor: string | null;
      /** Filters the list was ranked with; the cursor only continues that list. */
      filters: SuggestionFilters;
      more:
        | { status: "idle" }
        | { status: "loading" }
        | { status: "error"; message: string; expired: boolean };
    };

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function nearbyNote(
  overview: RoadmapSummaryDto,
  hasGps: boolean,
): string | null {
  if (hasGps)
    return "Ưu tiên quán trong bán kính 10 km quanh vị trí hiện tại của bạn.";
  if (overview.originMode === "pinned")
    return `Ưu tiên quán trong bán kính 10 km quanh ${overview.originLabel?.trim() || "điểm xuất phát đã chấm"}.`;
  if (overview.originMode === "gps")
    return "Muốn ưu tiên quán gần bạn, hãy cho phép vị trí ở phần Lịch trình rồi mở lại hộp này.";
  return null;
}

function Panel({
  roadmapId,
  overview,
  day,
  initialSlot,
  defaultProvince,
  gpsOrigin,
  service,
  onAdded,
}: {
  roadmapId: number;
  overview: RoadmapSummaryDto;
  day: RoadmapDayDto;
  initialSlot: MealSlot;
  defaultProvince: string;
  gpsOrigin?: { latitude: number; longitude: number };
  service: RoadmapItemService;
  onAdded: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<SuggestionFilters>({
    province: defaultProvince,
    q: "",
    maxPrice: "",
  });
  // Which meal of the day a picked dish goes to (RM-07 needs it); it does not filter the list.
  const [targetSlot, setTargetSlot] = useState<MealSlot>(initialSlot);
  const latest = useRef({ filters, touchedProvince: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // With a known province the first page loads at once, so the dialog never opens empty.
  const [list, setList] = useState<ListState>(
    defaultProvince.trim() ? { status: "loading" } : { status: "idle" },
  );
  const [added, setAdded] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [gone, setGone] = useState<Record<number, true>>({});
  const [failures, setFailures] = useState<Record<number, string>>({});
  const [announcement, setAnnouncement] = useState("");
  // The dish is saved but the roadmap behind this dialog could not be reloaded.
  const [stale, setStale] = useState(false);
  const sequence = useRef(0);
  const adding = useRef(false);
  const mounted = useRef(true);
  const [first] = useState(() => ({ filters, gpsOrigin }));
  latest.current.filters = filters;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function applyFirstPage(
    used: SuggestionFilters,
    page: {
      requestId: string;
      items: DishCardDto[];
      nextCursor: string | null;
    },
  ) {
    rememberDestination(roadmapId, used.province);
    setList({
      status: "ready",
      requestId: page.requestId,
      items: page.items,
      nextCursor: page.nextCursor,
      filters: used,
      more: { status: "idle" },
    });
  }

  useEffect(() => {
    if (!first.filters.province.trim()) return;
    const request = ++sequence.current;
    service
      .suggestions(
        roadmapId,
        buildSuggestionsQuery(first.filters, {
          dayId: day.dayId,
          gps: first.gpsOrigin,
        }),
      )
      .then((page) => {
        if (mounted.current && request === sequence.current)
          applyFirstPage(first.filters, page);
      })
      .catch((caught) => {
        if (mounted.current && request === sequence.current)
          setList({
            status: "error",
            message: suggestionsError(caught).message,
          });
      });
    // The first page is asked for once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No remembered or inferred province yet: read it from the roadmap's title ("Đi chơi Hà Nội").
  useEffect(() => {
    if (first.filters.province.trim()) return;
    void loadProvinceCatalog()
      .then((catalog) => {
        const name = provinceFromText(overview.title, catalog);
        if (!name || !mounted.current || latest.current.touchedProvince) return;
        const next = { ...latest.current.filters, province: name };
        setFilters(next);
        search(next);
      })
      .catch(() => undefined);
    // Runs once; the title is only a hint and the traveler can still type another province.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function search(next: SuggestionFilters) {
    const invalid = validateSuggestionFilters(next);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      setList({ status: "idle" });
      return;
    }
    const request = ++sequence.current;
    setList({ status: "loading" });
    setAnnouncement("");
    service
      .suggestions(
        roadmapId,
        buildSuggestionsQuery(next, { dayId: day.dayId, gps: gpsOrigin }),
      )
      .then((page) => {
        if (mounted.current && request === sequence.current)
          applyFirstPage(next, page);
      })
      .catch((caught) => {
        if (mounted.current && request === sequence.current)
          setList({
            status: "error",
            message: suggestionsError(caught).message,
          });
      });
  }

  function loadMore() {
    if (list.status !== "ready" || !list.nextCursor) return;
    if (list.more.status === "loading") return;
    const current = list;
    const request = ++sequence.current;
    setList({ ...current, more: { status: "loading" } });
    service
      .suggestions(
        roadmapId,
        buildSuggestionsQuery(current.filters, {
          dayId: day.dayId,
          gps: gpsOrigin,
          cursor: current.nextCursor,
        }),
      )
      .then((page) => {
        if (!mounted.current || request !== sequence.current) return;
        const known = new Set(current.items.map((dish) => dish.id));
        setList({
          ...current,
          items: [
            ...current.items,
            ...page.items.filter((dish) => !known.has(dish.id)),
          ],
          nextCursor: page.nextCursor,
          more: { status: "idle" },
        });
      })
      .catch((caught) => {
        if (!mounted.current || request !== sequence.current) return;
        const failure = suggestionsError(caught);
        setList({
          ...current,
          more: {
            status: "error",
            message: failure.message,
            expired: failure.expired,
          },
        });
      });
  }

  async function add(dish: DishCardDto) {
    if (list.status !== "ready" || adding.current) return;
    if (added[dish.id] || gone[dish.id]) return;
    adding.current = true;
    setPending(dish.id);
    setFailures((previous) => {
      const { [dish.id]: removed, ...rest } = previous;
      void removed;
      return rest;
    });
    try {
      const item = await service.addItem(
        roadmapId,
        day.dayId,
        buildAddItemRequest(dish, targetSlot, list.requestId),
      );
      if (!mounted.current) return;
      const slot = mealSlotLabels[item.mealSlot];
      setAdded((previous) => ({ ...previous, [dish.id]: slot }));
      setAnnouncement(`Đã thêm ${dish.name} vào ${lower(slot)}.`);
      try {
        await onAdded();
      } catch {
        if (mounted.current) setStale(true);
      }
    } catch (caught) {
      if (!mounted.current) return;
      const failure = addItemError(caught);
      if (failure.unavailable)
        setGone((previous) => ({ ...previous, [dish.id]: true }));
      setFailures((previous) => ({ ...previous, [dish.id]: failure.message }));
    } finally {
      adding.current = false;
      if (mounted.current) setPending(null);
    }
  }

  const note = nearbyNote(overview, gpsOrigin !== undefined);
  const slotLabel = lower(mealSlotLabels[targetSlot]);
  return (
    <div className="roadmap-add stack">
      <p className="helper">
        Chọn món ANGI gợi ý cho {dayTitle(day)}. Danh sách đã loại các món đang
        có trong lộ trình.
      </p>
      <form
        className="roadmap-add-filters"
        noValidate
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          search(filters);
        }}
      >
        <ProvinceField
          label="Tỉnh / thành phố"
          name="province"
          value={filters.province}
          required
          maxLength={100}
          error={errors.province}
          showCatalogStatus={false}
          onChange={(value) => {
            latest.current.touchedProvince = true;
            setFilters((previous) => ({ ...previous, province: value }));
            setErrors((previous) => ({ ...previous, province: "" }));
          }}
        />
        <Field
          label="Tìm món hoặc quán"
          name="q"
          type="search"
          autoComplete="off"
          placeholder="Ví dụ: bún bò"
          value={filters.q}
          onChange={(event) =>
            setFilters((previous) => ({ ...previous, q: event.target.value }))
          }
        />
        <VndField
          label="Giá tối đa mỗi món"
          name="maxPrice"
          value={filters.maxPrice}
          placeholder="Không giới hạn"
          error={errors.maxPrice}
          onValueChange={(digits) => {
            setFilters((previous) => ({ ...previous, maxPrice: digits }));
            setErrors((previous) => ({ ...previous, maxPrice: "" }));
          }}
        />
        <Button type="submit" loading={list.status === "loading"}>
          Tìm món
        </Button>
      </form>
      <div className="roadmap-add-target">
        <SelectField
          label="Thêm món đã chọn vào"
          name="mealSlot"
          value={targetSlot}
          onChange={(value) => setTargetSlot(value as MealSlot)}
          options={mealSlots.map((slot) => ({
            value: slot,
            label: mealSlotLabels[slot],
          }))}
        />
      </div>
      {note && <p className="helper">{note}</p>}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {announcement && (
        <p className="roadmap-add-notice" aria-hidden="true">
          ✓ {announcement}
        </p>
      )}

      {stale && (
        <Alert tone="warning">
          Món đã được thêm nhưng chưa tải lại được lộ trình. Hãy đóng hộp này
          rồi tải lại trang để xem đầy đủ.
        </Alert>
      )}

      {list.status === "idle" && (
        <p className="roadmap-add-hint">
          Chọn tỉnh / thành phố bạn sẽ ăn rồi bấm “Tìm món” để xem gợi ý. ANGI
          chưa biết lộ trình này đi tỉnh nào.
        </p>
      )}
      {list.status === "loading" && <Skeleton rows={3} />}
      {list.status === "error" && (
        <div className="stack-sm">
          <Alert>{list.message}</Alert>
          <Button variant="secondary" onClick={() => search(filters)}>
            Thử lại
          </Button>
        </div>
      )}
      {list.status === "ready" &&
        (list.items.length ? (
          <section className="stack-sm" aria-labelledby="roadmap-add-results">
            <h3 id="roadmap-add-results" className="roadmap-add-results-title">
              Món gợi ý tại {list.filters.province.trim()}
            </h3>
            <ul className="roadmap-suggestions">
              {list.items.map((dish) => {
                const done = added[dish.id];
                const unavailable = gone[dish.id] || !dish.isAvailable;
                const place = [
                  dish.restaurant.district,
                  dish.restaurant.provinceName,
                ]
                  .filter(Boolean)
                  .join(", ");
                const blocked =
                  Boolean(done) ||
                  unavailable ||
                  (pending !== null && pending !== dish.id);
                return (
                  <li key={dish.id} className="roadmap-suggestion">
                    <Media
                      className="roadmap-suggestion-media"
                      src={dish.coverUrl ?? undefined}
                      alt={dish.name}
                    />
                    <div className="roadmap-suggestion-text">
                      <h4>{dish.name}</h4>
                      <p className="roadmap-suggestion-price">
                        {vnd(dish.price)}
                      </p>
                      <p className="helper">
                        {dish.restaurant.name}
                        {place && ` · ${place}`}
                        {` · ${formatRating(dish.restaurant.ratingAvg)} sao`}
                      </p>
                      {dish.tags.length > 0 && (
                        <p className="roadmap-suggestion-tags">
                          {dish.tags.slice(0, 3).map((tag) => (
                            <span key={tag.id}>{tag.name}</span>
                          ))}
                        </p>
                      )}
                      {unavailable && (
                        <Badge tone="warning">Món không còn khả dụng</Badge>
                      )}
                      {failures[dish.id] && (
                        <p className="field-error" role="alert">
                          {failures[dish.id]}
                        </p>
                      )}
                    </div>
                    <Button
                      variant={done ? "tertiary" : "secondary"}
                      loading={pending === dish.id}
                      aria-disabled={blocked || undefined}
                      aria-label={
                        done
                          ? `${dish.name}: đã thêm vào ${lower(done)}`
                          : `Thêm ${dish.name} vào ${slotLabel}`
                      }
                      onClick={() => {
                        if (!blocked) void add(dish);
                      }}
                    >
                      {done ? "✓ Đã thêm" : `+ Thêm vào ${slotLabel}`}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {list.more.status === "error" && (
              <div className="stack-sm">
                <Alert>{list.more.message}</Alert>
                <Button
                  variant="secondary"
                  onClick={() =>
                    list.more.status === "error" && list.more.expired
                      ? search(filters)
                      : loadMore()
                  }
                >
                  {list.more.status === "error" && list.more.expired
                    ? "Tải lại gợi ý"
                    : "Thử lại"}
                </Button>
              </div>
            )}
            {list.nextCursor && list.more.status !== "error" && (
              <Button
                variant="secondary"
                loading={list.more.status === "loading"}
                onClick={loadMore}
              >
                Xem thêm món
              </Button>
            )}
          </section>
        ) : (
          <EmptyState title="Chưa có món phù hợp">
            Thử bỏ bớt bộ lọc hoặc đổi tỉnh / thành phố. Các món đang có trong
            lộ trình không xuất hiện ở đây.
          </EmptyState>
        ))}
    </div>
  );
}

/** F-24: pick a suggested dish (RM-06) and add it to a day of the roadmap (RM-07). */
export function RoadmapAddItemDialog({
  roadmapId,
  overview,
  day,
  initialSlot,
  defaultProvince,
  gpsOrigin,
  service,
  onAdded,
  onClose,
}: {
  roadmapId: number;
  overview: RoadmapSummaryDto;
  day: RoadmapDayDto;
  initialSlot: MealSlot;
  defaultProvince: string;
  gpsOrigin?: { latitude: number; longitude: number };
  service: RoadmapItemService;
  onAdded: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      wide
      focusField={!defaultProvince.trim()}
      title={`Thêm món vào ${dayTitle(day)}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Xong
        </Button>
      }
    >
      <Panel
        roadmapId={roadmapId}
        overview={overview}
        day={day}
        initialSlot={initialSlot}
        defaultProvince={defaultProvince}
        gpsOrigin={gpsOrigin}
        service={service}
        onAdded={onAdded}
      />
    </Dialog>
  );
}
