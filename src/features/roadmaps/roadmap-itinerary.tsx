"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { useItemDrag, type GripProps } from "./roadmap-item-drag";
import {
  applyPatches,
  moveAnnouncement,
  moveItemError,
  moveReloadFailed,
  patchBody,
  planMove,
  stepTarget,
  type MoveTarget,
} from "./roadmap-reorder-rules";
import { RateItemButtons } from "./roadmap-rate-item";
import {
  ratedNotice,
  rateFailedNotice,
  rateItemError,
  rateReloadFailed,
  type RatingValue,
} from "./roadmap-rate-rules";
import {
  removeFailedNotice,
  removeItemError,
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

/** How long a success notice stays; a warning stays until the traveler acts again. */
const successNoticeMs = 5000;

/** What follows a removal, shown in the day it happened in. */
interface DayNotice {
  dayNumber: number;
  tone: "success" | "warning";
  text: string;
  /** The card is still there, so the notice does not take the focus (a removal's does). */
  quiet?: boolean;
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
  reorder,
  dragging,
  onRate,
}: {
  item: RoadmapItemDto;
  order: number;
  /** The grip is held: the card lifts, the leg line above it stays put. */
  dragging: boolean;
  /** RM-13: rates the dish once; rejects for a failure the traveler can retry. */
  onRate: (value: RatingValue) => Promise<void>;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  reorder: {
    busy: boolean;
    hintId: string;
    grip: GripProps;
    onStep: (direction: -1 | 1) => void;
  };
}) {
  const { dish } = item;
  const notice = dishNotice(dish);
  const place = [dish.restaurant.district, dish.restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  return (
    <article
      className={`roadmap-item ${dragging ? "is-dragging" : ""}`.trim()}
      data-selected={selected}
      aria-labelledby={`roadmap-item-${item.id}`}
    >
      <div className="card roadmap-item-text">
        <button
          type="button"
          className="roadmap-item-grip"
          aria-label={`Đổi thứ tự ${dish.name}`}
          aria-describedby={reorder.hintId}
          aria-keyshortcuts="ArrowUp ArrowDown"
          aria-disabled={reorder.busy || undefined}
          title="Kéo để đổi thứ tự"
          {...reorder.grip}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            if (!reorder.busy) reorder.onStep(event.key === "ArrowUp" ? -1 : 1);
          }}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            {[4.5, 11.5].flatMap((x) =>
              [3.5, 8, 12.5].map((y) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />
              )),
            )}
          </svg>
        </button>
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
        {(notice || item.source === "ai") && (
          <p className="roadmap-item-badges">
            {notice && <Badge tone="warning">{notice}</Badge>}
            {item.source === "ai" && <Badge>ANGI gợi ý</Badge>}
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
          <RateItemButtons item={item} onRate={onRate} />
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
  onMove,
  moving,
  onRate,
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
  /** The traveler dropped a dish somewhere else in this day (RM-08). */
  onMove: (itemId: number, target: MoveTarget) => void;
  /** A move is being saved: no new one can start. */
  moving: boolean;
  /** The traveler rates a dish of this day (RM-13). */
  onRate: (item: RoadmapItemDto, value: RatingValue) => Promise<void>;
  notice: DayNotice | null;
}) {
  const noticeRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusGrip = useRef<number | null>(null);
  const { drag, gripProps } = useItemDrag({
    containerRef: bodyRef,
    disabled: moving,
    onDrop: onMove,
  });
  // A keyboard move re-renders the card in its new place: give the grip its focus back.
  useEffect(() => {
    const id = focusGrip.current;
    if (id === null) return;
    const grip = bodyRef.current?.querySelector<HTMLElement>(
      `[data-item-id="${id}"] .roadmap-item-grip`,
    );
    if (grip) {
      grip.focus();
      focusGrip.current = null;
    }
  }, [day.items]);
  // The removed card is gone with the focus on it: move the focus to what happened.
  useEffect(() => {
    if (notice && !notice.quiet) noticeRef.current?.focus();
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
        <div
          id={bodyId}
          ref={bodyRef}
          className="roadmap-day-body stack"
          aria-busy={moving || undefined}
          data-dragging={drag ? "true" : undefined}
        >
          <p id={`reorder-hint-${day.dayNumber}`} className="sr-only">
            Kéo biểu tượng ở góc thẻ món để đổi thứ tự, hoặc bấm phím mũi tên
            lên xuống khi đang chọn biểu tượng đó.
          </p>
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
                data-meal={group.mealSlot}
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
                      <li key={item.id} data-item-id={item.id}>
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
                          dragging={drag?.itemId === item.id}
                          onRate={(value) => onRate(item, value)}
                          reorder={{
                            busy: moving,
                            hintId: `reorder-hint-${day.dayNumber}`,
                            grip: gripProps(item.id),
                            onStep: (direction) => {
                              const target = stepTarget(
                                day.items,
                                item.id,
                                direction,
                              );
                              if (!target) return;
                              focusGrip.current = item.id;
                              onMove(item.id, target);
                            },
                          }}
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
          {drag?.indicator && (
            <div
              className="roadmap-drop-indicator"
              aria-hidden
              style={{
                top: drag.indicator.top,
                left: drag.indicator.left,
                width: drag.indicator.width,
              }}
            />
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
  itinerary: serverItinerary,
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
  onItemsMoved,
  onItemRated,
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
  /** RM-08 saved a new order: the parent reloads the roadmap, rejecting when that fails. */
  onItemsMoved: () => Promise<void>;
  /** RM-13 saved a rating: the parent reloads the roadmap, rejecting when that fails. */
  onItemRated: () => Promise<void>;
}) {
  // The order the traveler chose is shown at once; RM-03 confirms it (or takes it back).
  const [moved, setMoved] = useState<{
    dayNumber: number;
    items: RoadmapItemDto[];
  } | null>(null);
  const [moving, setMoving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const itinerary = useMemo(
    () =>
      moved
        ? serverItinerary.map((day) =>
            day.dayNumber === moved.dayNumber
              ? { ...day, items: moved.items }
              : day,
          )
        : serverItinerary,
    [serverItinerary, moved],
  );
  const [generateTarget, setGenerateTarget] = useState<{
    scope: GenerationScope;
    dayNumber: number;
  } | null>(null);
  // One removal at a time: a second press on the same dish must not send RM-09 twice.
  const removing = useRef(false);
  const [notice, setNotice] = useState<DayNotice | null>(null);
  // "Đã xóa … khỏi lộ trình." is only confirmation: it goes away by itself after 5 seconds.
  useEffect(() => {
    if (notice?.tone !== "success") return;
    const timer = setTimeout(() => setNotice(null), successNoticeMs);
    return () => clearTimeout(timer);
  }, [notice]);
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
      // The order shown is not saved yet: RM-14 would still answer for the old one. It is asked
      // once the roadmap is read again, with the order the backend confirms.
      if (moved?.dayNumber === day.dayNumber) continue;
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
    moved,
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

  /**
   * Saves a new place for one dish (RM-08, one call per dish whose position changed), then reads
   * the roadmap again. A failure takes the shown order back and says so in the day.
   */
  async function moveItem(
    dayNumber: number,
    itemId: number,
    target: MoveTarget,
  ) {
    const day = serverItinerary.find((entry) => entry.dayNumber === dayNumber);
    if (!day || moving) return;
    const patches = planMove(day.items, itemId, target);
    if (!patches.length) return;
    setMoving(true);
    setNotice(null);
    setMoved({ dayNumber, items: applyPatches(day.items, patches) });
    setAnnouncement(moveAnnouncement(day.items, itemId, target));
    try {
      for (const patch of patches)
        await service.updateItem(roadmapId, patch.itemId, patchBody(patch));
      await onItemsMoved();
      if (mounted.current) setMoved(null);
    } catch (caught) {
      if (!mounted.current) return;
      setMoved(null);
      setAnnouncement("");
      let text = moveItemError(caught);
      try {
        await onItemsMoved();
      } catch {
        text = moveReloadFailed;
      }
      if (mounted.current) setNotice({ dayNumber, tone: "warning", text });
    } finally {
      if (mounted.current) setMoving(false);
    }
  }

  /**
   * Rates a dish (RM-13) at once and reads the roadmap again, so the buttons are the backend's.
   * A dish that was rated before or has left the roadmap is settled with a notice; any other
   * failure is a warning in the day and the buttons stay pressable.
   */
  async function rateItem(
    dayNumber: number,
    item: RoadmapItemDto,
    value: RatingValue,
  ) {
    let text = ratedNotice(value, item.dish.name);
    let tone: DayNotice["tone"] = "success";
    try {
      await service.rateItem(roadmapId, item.id, { value });
    } catch (caught) {
      const failure = rateItemError(caught, item.dish.name);
      if (!failure.settled) {
        if (mounted.current)
          setNotice({
            dayNumber,
            tone: "warning",
            text: rateFailedNotice(item.dish.name, failure.message),
            quiet: true,
          });
        return;
      }
      text = failure.message;
      tone = "warning";
    }
    try {
      await onItemRated();
    } catch {
      text = rateReloadFailed;
      tone = "warning";
    }
    if (!mounted.current) return;
    // A saved rating shows on the button itself; only something to read gets a notice.
    if (tone === "success") setAnnouncement(text);
    else setNotice({ dayNumber, tone, text, quiet: true });
  }

  /**
   * Deletes a dish (RM-09) at once. Once it is gone (now, or already elsewhere) the map selection
   * is left, the day says so and RM-03 is read again; any other failure leaves the dish in place.
   */
  async function removeItem(dayNumber: number, item: RoadmapItemDto) {
    if (removing.current) return;
    removing.current = true;
    setNotice(null);
    try {
      let outcome: RemoveOutcome = "removed";
      try {
        await service.deleteItem(roadmapId, item.id);
      } catch (caught) {
        const failure = removeItemError(caught);
        if (!failure.gone) {
          if (mounted.current)
            setNotice({
              dayNumber,
              tone: "warning",
              text: removeFailedNotice(item.dish.name, failure.message),
              quiet: true,
            });
          return;
        }
        outcome = "already-gone";
      }
      if (!mounted.current) return;
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
    } finally {
      removing.current = false;
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
            onRemove={(item) => void removeItem(day.dayNumber, item)}
            onGenerate={() => {
              setNotice(null);
              setGenerateTarget({ scope: "day", dayNumber: day.dayNumber });
            }}
            moving={moving}
            onRate={(item, value) => rateItem(day.dayNumber, item, value)}
            onMove={(itemId, target) =>
              void moveItem(day.dayNumber, itemId, target)
            }
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
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
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
      {addTarget && addDay && (
        <RoadmapAddItemDialog
          roadmapId={roadmapId}
          overview={overview}
          day={addDay}
          days={itinerary}
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
