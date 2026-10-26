"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button } from "@/shared/ui";
import { Icon, Media } from "@/components/ui/primitives";
import { getErrorMessage } from "@/shared/api/error";
import {
  classifyGpsError,
  dayDishSummary,
  dayTitle,
  dishNotice,
  formatDistance,
  formatDuration,
  formatRating,
  googleMapsDayLink,
  gpsRouteMessages,
  groupByMeal,
  legEndpoints,
  legsByTarget,
  mealSlotLabels,
  wantsDayRoute,
  type GpsProblem,
} from "./roadmap-detail-rules";
import { RoadmapAddItemDialog } from "./roadmap-add-item-dialog";
import { mostCommonProvince, nextMealSlot } from "./roadmap-add-item-rules";
import { recallDestination } from "./roadmap-destination";
import { vnd } from "./roadmap-list-rules";
import { RoadmapGenerateDialog } from "./roadmap-generate-dialog";
import { RoadmapRemoveItemDialog } from "./roadmap-remove-item-dialog";
import {
  removeNotice,
  removeReloadFailed,
  type RemoveOutcome,
} from "./roadmap-remove-item-rules";
import type { RoadmapScreenService } from "./roadmap-service";
import type {
  GenerationScope,
  MealSlot,
  RoadmapDayDto,
  RoadmapItemDto,
  RoadmapRouteDto,
  RoadmapSummaryDto,
} from "./roadmap-types";

type RouteState =
  | { status: "error"; message: string }
  | { status: "ready"; route: RoadmapRouteDto };

/** What follows a removal, shown in the day it happened in. */
interface DayNotice {
  dayNumber: number;
  tone: "success" | "warning";
  text: string;
}

type GpsState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "granted"; latitude: number; longitude: number }
  | { status: "problem"; problem: GpsProblem };

/**
 * Cache key of a day's legs: the dishes are part of it, so a day that gained a dish is asked
 * again (once), while an unchanged day keeps its answer.
 */
function routeKey(
  day: RoadmapDayDto,
  latitude: number | undefined,
  longitude: number | undefined,
) {
  const dishes = day.items.map((item) => item.id).join(".");
  return `${day.dayId}:${dishes}:${latitude === undefined ? "-" : `${latitude},${longitude}`}`;
}

function ItemCard({
  item,
  order,
  selected,
  onSelect,
  onRemove,
}: {
  item: RoadmapItemDto;
  order: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { dish } = item;
  const notice = dishNotice(dish);
  const place = [dish.restaurant.district, dish.restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  return (
    <article
      className="roadmap-item"
      data-selected={selected}
      aria-labelledby={`roadmap-item-${item.id}`}
    >
      <div className="card roadmap-item-text">
        <h5 id={`roadmap-item-${item.id}`}>
          <span className="roadmap-item-order" aria-hidden>
            {order}
          </span>
          {dish.name}
        </h5>
        <p className="roadmap-item-price">Dự chi {vnd(dish.price)}</p>
        <p className="helper">
          {dish.restaurant.name}
          {place && ` · ${place}`}
          {` · ${formatRating(dish.restaurant.ratingAvg)} sao`}
        </p>
        {(notice || item.source === "ai" || item.myFeedback) && (
          <p className="roadmap-item-badges">
            {notice && <Badge tone="warning">{notice}</Badge>}
            {item.source === "ai" && <Badge>ANGI gợi ý</Badge>}
            {item.myFeedback && (
              <Badge>
                {item.myFeedback === "like"
                  ? "Bạn đã thích món này"
                  : "Bạn đã không thích món này"}
              </Badge>
            )}
          </p>
        )}
        <div className="roadmap-item-actions">
          <Button
            variant="tertiary"
            className="roadmap-item-remove"
            aria-label={`Xóa ${dish.name} khỏi lộ trình`}
            onClick={onRemove}
          >
            <Icon name="trash" />
            <span>Xóa món</span>
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="roadmap-item-location"
        aria-label={`Xem vị trí ${dish.name}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <Media
          className="roadmap-item-media"
          src={dish.coverUrl ?? undefined}
          alt={dish.name}
        />
        <span className="roadmap-item-map-link">
          <Icon name="LocateFixed" />
          <span>Xem vị trí</span>
        </span>
      </button>
    </article>
  );
}

function DayPanel({
  day,
  overview,
  open,
  onToggle,
  route,
  loading,
  onRetry,
  selectedItemId,
  onSelectItem,
  onAdd,
  onRemove,
  onGenerate,
  notice,
}: {
  day: RoadmapDayDto;
  overview: RoadmapSummaryDto;
  open: boolean;
  onToggle: () => void;
  route: RouteState | undefined;
  loading: boolean;
  onRetry: () => void;
  selectedItemId: number | null;
  onSelectItem: (id: number | null) => void;
  /** Opens the add-dish dialog for this day, on the given meal when one is clicked. */
  onAdd: (slot?: MealSlot) => void;
  /** Asks to remove an item of this day (the parent confirms and calls RM-09). */
  onRemove: (item: RoadmapItemDto) => void;
  /** Opens the AI dialog for this day. */
  onGenerate: () => void;
  notice: DayNotice | null;
}) {
  const noticeRef = useRef<HTMLDivElement>(null);
  // The removed card is gone with the focus on it: move the focus to what happened.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  const maps = googleMapsDayLink(overview, day.items);
  const legs = route?.status === "ready" ? legsByTarget(route.route) : null;
  const bodyId = `day-body-${day.dayNumber}`;
  return (
    <section
      id={`day-${day.dayNumber}`}
      className="roadmap-day"
      aria-labelledby={`day-title-${day.dayNumber}`}
    >
      <h3 id={`day-title-${day.dayNumber}`}>
        <button
          type="button"
          className="roadmap-day-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="roadmap-chevron" aria-hidden>
            <Icon name="roadmap-chevron" />
          </span>
          <span>{dayTitle(day)}</span>
        </button>
      </h3>
      <p className="roadmap-day-sub">
        {open
          ? `Ngày ${day.dayNumber} · ${
              day.items.length
                ? `${day.items.length} món · ${vnd(day.dayCost)}`
                : "Chưa có món"
            }`
          : dayDishSummary(day.items)}
      </p>
      {open && (
        <div id={bodyId} className="roadmap-day-body stack">
          <div className="roadmap-day-actions">
            <Button onClick={() => onAdd()}>+ Thêm món</Button>
            <Button variant="secondary" onClick={onGenerate}>
              Gợi ý bằng AI
            </Button>
            {maps && (
              <a
                className="button button-secondary"
                href={maps.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở trên Google Maps
                <span className="sr-only"> (mở tab mới)</span>
              </a>
            )}
          </div>
          {notice && (
            <div ref={noticeRef} tabIndex={-1} className="roadmap-day-notice">
              <Alert tone={notice.tone}>{notice.text}</Alert>
            </div>
          )}
          {maps?.truncated && (
            <p className="helper">
              Google Maps nhận tối đa {maps.stops} điểm, nên liên kết chỉ gồm{" "}
              {maps.stops} quán đầu của ngày.
            </p>
          )}

          {loading && (
            <p className="helper" role="status">
              Đang tính quãng đường…
            </p>
          )}
          {route?.status === "error" && (
            <div className="stack-sm">
              <Alert>{route.message}</Alert>
              <Button variant="secondary" onClick={onRetry}>
                Thử lại
              </Button>
            </div>
          )}
          {route?.status === "ready" && (
            <div className="stack-sm">
              {route.route.legs.length > 0 ? (
                <p className="roadmap-route-total">
                  <Icon name="motorcycle" />
                  <span>
                    Cả ngày:{" "}
                    <strong>
                      {formatDistance(route.route.totalDistanceMeters)} ·{" "}
                      {formatDuration(route.route.totalDurationSeconds)}
                    </strong>
                  </span>
                  {route.route.isEstimated && (
                    <Badge tone="warning">Ước tính</Badge>
                  )}
                </p>
              ) : (
                <p className="helper">Chưa đủ điểm để tính quãng đường.</p>
              )}
              {route.route.isEstimated && (
                <p className="helper">
                  Quãng đường được ước tính theo đường chim bay vì chưa lấy được
                  dữ liệu đường đi.
                </p>
              )}
              {route.route.originSkipped && (
                <Alert tone="info">
                  Điểm xuất phát cách quán đầu tiên hơn 30 km nên chặng đầu
                  không được tính.
                </Alert>
              )}
            </div>
          )}

          {day.items.length ? (
            groupByMeal(day.items).map((group) => (
              <div
                key={`${group.mealSlot}-${group.items[0].id}`}
                className="roadmap-meal"
              >
                <div className="roadmap-meal-header">
                  <h4 className="roadmap-meal-heading">
                    {mealSlotLabels[group.mealSlot]}
                  </h4>
                  <Button
                    aria-label={`Thêm món vào ${mealSlotLabels[group.mealSlot].toLowerCase()}`}
                    onClick={() => onAdd(group.mealSlot)}
                  >
                    + Thêm món
                  </Button>
                </div>
                <ol className="roadmap-items">
                  {group.items.map((item) => {
                    const leg = legs?.get(item.id);
                    return (
                      <li key={item.id}>
                        {leg && (
                          <p className="roadmap-leg">
                            <span className="roadmap-leg-connector">
                              <Icon name="connection" />
                            </span>
                            <Icon name="motorcycle" />
                            <span className="roadmap-leg-text">
                              <span>
                                <strong>
                                  {formatDistance(leg.distanceMeters)}
                                </strong>{" "}
                                · Khoảng {formatDuration(leg.durationSeconds)}
                              </span>
                              <small>
                                {legEndpoints(
                                  leg,
                                  day.items,
                                  overview.originLabel,
                                )}
                              </small>
                            </span>
                          </p>
                        )}
                        <ItemCard
                          item={item}
                          order={
                            day.items.findIndex(
                              (entry) => entry.id === item.id,
                            ) + 1
                          }
                          selected={selectedItemId === item.id}
                          onSelect={() => onSelectItem(item.id)}
                          onRemove={() => onRemove(item)}
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))
          ) : (
            <p className="roadmap-empty-day">
              Ngày này chưa có món nào. Bấm “Thêm món” để chọn món ANGI gợi ý.
            </p>
          )}
          {day.items.length > 0 && (
            <p className="roadmap-day-total">
              Tổng dự chi hôm nay: <strong>{vnd(day.dayCost)}</strong>. Giá tính
              theo giá hiện tại của từng món.
            </p>
          )}
          {day.note && (
            <p className="helper">
              <strong>Ghi chú:</strong> {day.note}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Collapsible days (Figma "Thứ Sáu, 25 tháng 9") with the legs of RM-14. A day's legs are
 * asked for when it is open and the tab is visible, once per (day, origin) pair.
 */
export function RoadmapItinerary({
  roadmapId,
  overview,
  itinerary,
  openDays,
  onToggleDay,
  active,
  service,
  selectedItemId,
  onSelectItem,
  mapDayNumber,
  onMapRouteChange,
  onItemAdded,
  onItemRemoved,
  onItemsGenerated,
}: {
  roadmapId: number;
  overview: RoadmapSummaryDto;
  itinerary: RoadmapDayDto[];
  openDays: number[];
  onToggleDay: (dayNumber: number) => void;
  active: boolean;
  service: RoadmapScreenService;
  selectedItemId: number | null;
  onSelectItem: (id: number | null) => void;
  mapDayNumber: number;
  onMapRouteChange: (route: RoadmapRouteDto | null) => void;
  /** RM-07 succeeded: the parent reloads the roadmap so every figure comes from RM-03. */
  onItemAdded: () => Promise<void>;
  /** RM-09 succeeded: the parent reloads the roadmap, rejecting when that fails. */
  onItemRemoved: () => Promise<void>;
  /** RM-10 job succeeded: the parent reloads the roadmap, rejecting when that fails. */
  onItemsGenerated: () => Promise<void>;
}) {
  const [generateTarget, setGenerateTarget] = useState<{
    scope: GenerationScope;
    dayNumber: number;
  } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    dayNumber: number;
    item: RoadmapItemDto;
  } | null>(null);
  const [notice, setNotice] = useState<DayNotice | null>(null);
  const [addTarget, setAddTarget] = useState<{
    dayNumber: number;
    slot: MealSlot;
    province: string;
  } | null>(null);
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [routes, setRoutes] = useState<Record<string, RouteState>>({});
  const [attempt, setAttempt] = useState(0);
  const started = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const gpsLatitude = gps.status === "granted" ? gps.latitude : undefined;
  const gpsLongitude = gps.status === "granted" ? gps.longitude : undefined;
  const keyOf = (day: RoadmapDayDto) =>
    routeKey(day, gpsLatitude, gpsLongitude);
  const mapDay = itinerary.find((day) => day.dayNumber === mapDayNumber);
  const mapRouteState = mapDay ? routes[keyOf(mapDay)] : undefined;
  useEffect(() => {
    onMapRouteChange(
      mapRouteState?.status === "ready" ? mapRouteState.route : null,
    );
  }, [mapRouteState, onMapRouteChange]);

  useEffect(() => {
    if (!active) return;
    const gpsOrigin =
      gpsLatitude === undefined || gpsLongitude === undefined
        ? undefined
        : { latitude: gpsLatitude, longitude: gpsLongitude };
    for (const day of itinerary) {
      if (!openDays.includes(day.dayNumber)) continue;
      if (!wantsDayRoute(overview, day.items, gpsOrigin !== undefined))
        continue;
      const key = routeKey(day, gpsLatitude, gpsLongitude);
      if (started.current.has(key)) continue;
      started.current.add(key);
      service
        .dayRoute(roadmapId, day.dayId, gpsOrigin)
        .then((route) => {
          if (mounted.current)
            setRoutes((previous) => ({
              ...previous,
              [key]: { status: "ready", route },
            }));
        })
        .catch((caught) => {
          // Keep failures cached until the explicit retry action; selecting a map
          // stop or opening another day must not issue another provider request.
          if (mounted.current)
            setRoutes((previous) => ({
              ...previous,
              [key]: { status: "error", message: getErrorMessage(caught) },
            }));
        });
    }
  }, [
    active,
    itinerary,
    openDays,
    overview,
    gpsLatitude,
    gpsLongitude,
    roadmapId,
    service,
    attempt,
  ]);

  const addDay = addTarget
    ? itinerary.find((day) => day.dayNumber === addTarget.dayNumber)
    : undefined;
  const generateDay = generateTarget
    ? itinerary.find((day) => day.dayNumber === generateTarget.dayNumber)
    : undefined;
  /** The roadmap keeps no destination: reuse what the traveler typed, else the dishes' province. */
  const knownProvince = () =>
    recallDestination(roadmapId) || mostCommonProvince(itinerary);
  const removeDay = removeTarget
    ? itinerary.find((day) => day.dayNumber === removeTarget.dayNumber)
    : undefined;

  /** The item is gone: leave the map selection, say so in its day and read RM-03 again. */
  async function itemRemoved(outcome: RemoveOutcome) {
    if (!removeTarget) return;
    const { dayNumber, item } = removeTarget;
    setRemoveTarget(null);
    if (selectedItemId === item.id) onSelectItem(null);
    setNotice({
      dayNumber,
      tone: "success",
      text: removeNotice(outcome, item.dish.name),
    });
    try {
      await onItemRemoved();
    } catch {
      if (mounted.current)
        setNotice({ dayNumber, tone: "warning", text: removeReloadFailed });
    }
  }

  /** The browser asks the traveler here; coordinates stay in memory only. */
  function askCurrentPosition() {
    if (!navigator.geolocation) {
      setGps({
        status: "problem",
        problem: window.isSecureContext ? "unavailable" : "insecure",
      });
      return;
    }
    setGps({ status: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (mounted.current)
          setGps({
            status: "granted",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
      },
      (error) => {
        if (mounted.current)
          setGps({
            status: "problem",
            problem: classifyGpsError(error.code, window.isSecureContext),
          });
      },
      { timeout: 10000, maximumAge: 0 },
    );
  }

  function retry(key: string) {
    started.current.delete(key);
    setRoutes((previous) => {
      const { [key]: removed, ...rest } = previous;
      void removed;
      return rest;
    });
    setAttempt((value) => value + 1);
  }

  return (
    <div className="roadmap-itinerary stack">
      <h2 className="sr-only">Lịch trình</h2>
      <section className="roadmap-ai-banner" aria-labelledby="roadmap-ai-title">
        <div>
          <h3 id="roadmap-ai-title">Để ANGI lên lịch giúp bạn</h3>
          <p>
            ANGI chọn món hợp với bạn và gom các quán gần nhau trong từng ngày.
            Bạn xem lại rồi sửa từng món nếu muốn.
          </p>
        </div>
        <Button
          onClick={() => {
            setNotice(null);
            setGenerateTarget({
              scope: "full",
              dayNumber: itinerary[0]?.dayNumber ?? 1,
            });
          }}
        >
          Tạo lộ trình bằng AI
        </Button>
      </section>
      {overview.originMode === "gps" && (
        <div className="roadmap-gps stack-sm">
          {gps.status === "granted" ? (
            <p className="helper" role="status">
              Đang lấy vị trí hiện tại của bạn làm điểm xuất phát. Tọa độ không
              được lưu.
            </p>
          ) : (
            <p className="helper">
              Lộ trình này xuất phát từ vị trí hiện tại. Cho phép trình duyệt
              dùng vị trí để tính chặng đầu tiên.
            </p>
          )}
          {gps.status === "problem" && (
            <Alert tone="warning">{gpsRouteMessages[gps.problem]}</Alert>
          )}
          {gps.status === "granted" ? (
            <Button
              variant="tertiary"
              onClick={() => setGps({ status: "idle" })}
            >
              Bỏ vị trí hiện tại
            </Button>
          ) : (
            <Button
              variant="secondary"
              loading={gps.status === "asking"}
              onClick={askCurrentPosition}
            >
              Tính từ vị trí hiện tại
            </Button>
          )}
        </div>
      )}
      {itinerary.map((day) => {
        const key = keyOf(day);
        const open = openDays.includes(day.dayNumber);
        const route = routes[key];
        return (
          <DayPanel
            key={day.dayId}
            day={day}
            overview={overview}
            open={open}
            onToggle={() => onToggleDay(day.dayNumber)}
            route={route}
            loading={
              open &&
              !route &&
              wantsDayRoute(overview, day.items, gpsLatitude !== undefined)
            }
            onRetry={() => retry(key)}
            selectedItemId={selectedItemId}
            onSelectItem={onSelectItem}
            notice={notice?.dayNumber === day.dayNumber ? notice : null}
            onRemove={(item) => {
              setNotice(null);
              setRemoveTarget({ dayNumber: day.dayNumber, item });
            }}
            onGenerate={() => {
              setNotice(null);
              setGenerateTarget({ scope: "day", dayNumber: day.dayNumber });
            }}
            onAdd={(slot) =>
              setAddTarget({
                dayNumber: day.dayNumber,
                slot: slot ?? nextMealSlot(day),
                province: knownProvince(),
              })
            }
          />
        );
      })}
      {generateTarget && generateDay && (
        <RoadmapGenerateDialog
          roadmapId={roadmapId}
          overview={overview}
          itinerary={itinerary}
          initialScope={generateTarget.scope}
          initialDayId={generateDay.dayId}
          defaultProvince={knownProvince()}
          gpsOrigin={
            gpsLatitude === undefined || gpsLongitude === undefined
              ? undefined
              : { latitude: gpsLatitude, longitude: gpsLongitude }
          }
          service={service}
          onGenerated={onItemsGenerated}
          onClose={() => setGenerateTarget(null)}
        />
      )}
      {removeTarget && removeDay && (
        <RoadmapRemoveItemDialog
          roadmapId={roadmapId}
          day={removeDay}
          item={removeTarget.item}
          service={service}
          onRemoved={(outcome) => void itemRemoved(outcome)}
          onClose={() => setRemoveTarget(null)}
        />
      )}
      {addTarget && addDay && (
        <RoadmapAddItemDialog
          roadmapId={roadmapId}
          overview={overview}
          day={addDay}
          initialSlot={addTarget.slot}
          defaultProvince={addTarget.province}
          gpsOrigin={
            gpsLatitude === undefined || gpsLongitude === undefined
              ? undefined
              : { latitude: gpsLatitude, longitude: gpsLongitude }
          }
          service={service}
          onAdded={onItemAdded}
          onClose={() => setAddTarget(null)}
        />
      )}
    </div>
  );
}
