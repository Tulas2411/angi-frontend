"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { Button } from "@/shared/ui";
import { Icon, Media, Tabs } from "@/components/ui/primitives";
import { mapStyles } from "@/shared/maps/mapbox";
import { formatRating, mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import {
  groupRoadmapStops,
  roadmapMapCoordinate,
  roadmapMapPoints,
  roadmapMapStops,
  type RoadmapMapGroup,
  type RoadmapMapStop,
} from "./roadmap-map-rules";
import type {
  RoadmapDayDto,
  RoadmapRouteDto,
  RoadmapSummaryDto,
} from "./roadmap-types";
import "mapbox-gl/dist/mapbox-gl.css";

/** Shown when nothing is located yet: the whole country, like the owner location picker. */
const vietnamView = { center: [106.2, 16.3] as [number, number], zoom: 4.6 };

const mapCardTabs = [
  { value: "info", label: "Thông tin" },
  { value: "rating", label: "Đánh giá" },
  { value: "photo", label: "Ảnh món" },
] as const;
type MapCardTab = (typeof mapCardTabs)[number]["value"];

function SelectedMapCard({
  stop,
  coincident,
  onSelectItem,
}: {
  stop: RoadmapMapStop;
  coincident: readonly RoadmapMapStop[];
  onSelectItem: (id: number | null) => void;
}) {
  const [tab, setTab] = useState<MapCardTab>("info");
  const { dish } = stop.item;
  const place = [dish.restaurant.district, dish.restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  return (
    <section className="roadmap-map-card" aria-label="Địa điểm đã chọn">
      <div className="roadmap-map-card-heading">
        <Tabs
          label="Thông tin địa điểm"
          value={tab}
          items={[...mapCardTabs]}
          onChange={(value) => {
            const next = mapCardTabs.find((item) => item.value === value);
            if (next) setTab(next.value);
          }}
        />
        <Button
          variant="icon"
          aria-label="Đóng thông tin địa điểm"
          onClick={() => onSelectItem(null)}
        >
          <Icon name="X" />
        </Button>
      </div>
      <div className="roadmap-map-card-body">
        <h3>{dish.restaurant.name}</h3>
        <p className="helper">
          {stop.dayLabel} · {mealSlotLabels[stop.item.mealSlot]} · Điểm{" "}
          {stop.number}
        </p>
        <div role="tabpanel" aria-label="Thông tin" hidden={tab !== "info"}>
          <p>
            {dish.name} · Dự chi {vnd(dish.price)}
          </p>
          {place && <p className="helper">{place}</p>}
          {stop.coordinate ? (
            <p className="helper">
              {stop.coordinate.latitude.toFixed(5)},{" "}
              {stop.coordinate.longitude.toFixed(5)}
            </p>
          ) : (
            <p className="helper">Địa điểm này chưa có tọa độ trên bản đồ.</p>
          )}
          <span className="roadmap-map-included">Có trong lộ trình</span>
        </div>
        <div role="tabpanel" aria-label="Đánh giá" hidden={tab !== "rating"}>
          <p className="roadmap-map-card-rating">
            {dish.restaurant.ratingAvg > 0
              ? `★ ${formatRating(dish.restaurant.ratingAvg)} sao`
              : "Chưa có điểm đánh giá."}
          </p>
          <p className="helper">Điểm trung bình của nhà hàng.</p>
        </div>
        <div role="tabpanel" aria-label="Ảnh món" hidden={tab !== "photo"}>
          <Media
            className="roadmap-map-card-photo"
            src={dish.coverUrl ?? undefined}
            alt={`Ảnh món ${dish.name}`}
          />
          <p className="helper">Ảnh món {dish.name}</p>
        </div>
        {coincident.length > 1 && (
          <div className="roadmap-map-coincident">
            <p className="helper">
              {coincident.length} điểm trong lộ trình cùng vị trí
            </p>
            {coincident.map((point) => (
              <button
                key={point.item.id}
                type="button"
                aria-pressed={point.item.id === stop.item.id}
                onClick={() => onSelectItem(point.item.id)}
              >
                {point.dayLabel} · {point.number}. {point.item.dish.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Read-only RM-03 stop map. It never searches places or requests route geometry. */
export function RoadmapDetailMap({
  overview,
  itinerary,
  activeDay,
  selectedItemId,
  onSelectItem,
  origin,
  originSkipped = false,
}: {
  overview: RoadmapSummaryDto;
  itinerary: RoadmapDayDto[];
  activeDay: number;
  selectedItemId: number | null;
  onSelectItem: (id: number | null) => void;
  origin?: RoadmapRouteDto["origin"];
  originSkipped?: boolean;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const stops = useMemo(() => roadmapMapStops(itinerary), [itinerary]);
  const groups = useMemo(() => groupRoadmapStops(stops), [stops]);
  const selected =
    stops.find((stop) => stop.item.id === selectedItemId) ?? null;
  const coincident = selected?.coordinate
    ? (groups.find((group) =>
        group.stops.some((stop) => stop.item.id === selected.item.id),
      )?.stops ?? [])
    : [];
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const refresh = useRef<() => void>(() => {});
  const fit = useRef<() => void>(() => {});
  const latest = useRef({
    overview,
    stops,
    groups,
    activeDay,
    selectedItemId,
    onSelectItem,
    origin,
    originSkipped,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  // HTTP status of the provider error, when there is one (401 = the token was refused).
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    latest.current = {
      overview,
      stops,
      groups,
      activeDay,
      selectedItemId,
      onSelectItem,
      origin,
      originSkipped,
    };
  }, [
    overview,
    stops,
    groups,
    activeDay,
    selectedItemId,
    onSelectItem,
    origin,
    originSkipped,
  ]);

  useEffect(() => {
    refresh.current();
    fit.current();
  }, [groups, activeDay, selectedItemId, origin, originSkipped]);

  useEffect(() => {
    // The base map is drawn even before any dish has coordinates; pins appear with them.
    if (!token || !container.current) return;
    const element = container.current;
    let disposed = false;
    let instance: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    let startMarker: Marker | null = null;
    const markers: {
      group: RoadmapMapGroup;
      marker: Marker;
      button: HTMLButtonElement;
    }[] = [];
    const reducedMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fail = (event?: unknown) => {
      if (disposed) return;
      const code = (event as { error?: { status?: unknown } } | undefined)
        ?.error?.status;
      setErrorStatus(typeof code === "number" ? code : null);
      setStatus("error");
      observer?.disconnect();
      instance?.remove();
      instance = null;
      map.current = null;
    };

    async function initialize() {
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        if (disposed) return;
        const current = latest.current;
        const pinned =
          current.overview.originMode === "pinned"
            ? roadmapMapCoordinate(
                current.overview.originLatitude,
                current.overview.originLongitude,
              )
            : null;
        // First a located stop, then the pinned origin, else the whole of Vietnam.
        const located = roadmapMapPoints(
          current.stops,
          current.activeDay,
          current.origin,
          current.originSkipped,
        )[0];
        const initial =
          located ??
          (pinned
            ? ([pinned.longitude, pinned.latitude] as [number, number])
            : null);
        instance = new mapboxgl.Map({
          container: element,
          accessToken: token,
          style: mapStyles.streets,
          center: initial ?? vietnamView.center,
          zoom: initial ? 12 : vietnamView.zoom,
          minZoom: 2,
          maxZoom: 18,
          projection: "mercator",
          attributionControl: true,
          cooperativeGestures: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        map.current = instance;
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();

        fit.current = () => {
          if (!instance || disposed) return;
          // A responsive map panel may be hidden until the traveler opens it.
          if (element.clientWidth === 0 || element.clientHeight === 0) return;
          // The selected card and responsive columns can resize the CSS box
          // before ResizeObserver runs; fit against the current canvas size.
          instance.resize();
          const current = latest.current;
          const points = roadmapMapPoints(
            current.stops,
            current.activeDay,
            current.origin,
            current.originSkipped,
          );
          if (!points.length) return;
          if (points.length === 1)
            instance.easeTo({
              center: points[0],
              zoom: 14,
              duration: reducedMotion() ? 0 : 360,
            });
          else {
            const bounds = new mapboxgl.LngLatBounds(points[0], points[0]);
            for (const point of points.slice(1)) bounds.extend(point);
            const cardHeight =
              element.parentElement?.querySelector<HTMLElement>(
                ".roadmap-map-card",
              )?.offsetHeight ?? 0;
            const topPadding = current.selectedItemId === null ? 176 : 208;
            const bottomPadding = Math.min(
              current.selectedItemId === null ? 80 : cardHeight + 40,
              Math.max(0, element.clientHeight - topPadding - 48),
            );
            instance.fitBounds(bounds, {
              padding: {
                top: topPadding,
                right: 84,
                left: 44,
                bottom: bottomPadding,
              },
              maxZoom: 15,
              retainPadding: false,
              duration: reducedMotion() ? 0 : 360,
            });
          }
        };

        refresh.current = () => {
          if (!instance || disposed) return;
          const current = latest.current;
          for (const { group, button } of markers) {
            const representative =
              group.stops.find(
                (stop) => stop.item.id === current.selectedItemId,
              ) ??
              group.stops.find(
                (stop) => stop.dayNumber === current.activeDay,
              ) ??
              group.stops[0];
            button.dataset.tone = String((representative.dayNumber - 1) % 5);
            button.dataset.active = String(
              group.stops.some((stop) => stop.dayNumber === current.activeDay),
            );
            button.dataset.selected = String(
              group.stops.some(
                (stop) => stop.item.id === current.selectedItemId,
              ),
            );
            button.textContent =
              group.stops.length > 1
                ? `${representative.number}+${group.stops.length - 1}`
                : String(representative.number);
            button.setAttribute(
              "aria-label",
              group.stops.length > 1
                ? `${group.stops.length} điểm cùng vị trí: ${group.stops.map((stop) => `${stop.item.dish.name}, ngày ${stop.dayNumber}`).join("; ")}`
                : `Điểm ${representative.number}, ngày ${representative.dayNumber}: ${representative.item.dish.name}`,
            );
            button.setAttribute("aria-pressed", button.dataset.selected);
          }
          startMarker?.remove();
          startMarker = null;
          const start =
            current.origin && !current.originSkipped
              ? roadmapMapCoordinate(
                  current.origin.latitude,
                  current.origin.longitude,
                )
              : null;
          if (start) {
            const pin = document.createElement("span");
            pin.className = "roadmap-map-origin";
            pin.textContent = "●";
            pin.setAttribute("role", "img");
            pin.setAttribute(
              "aria-label",
              current.origin?.label || "Điểm xuất phát",
            );
            startMarker = new mapboxgl.Marker({ element: pin })
              .setLngLat([start.longitude, start.latitude])
              .addTo(instance);
          }
        };

        instance.on("load", () => {
          if (!instance || disposed) return;
          for (const group of groups) {
            const button = document.createElement("button");
            button.type = "button";
            // Mapbox otherwise assigns role="img", overriding native button semantics.
            button.setAttribute("role", "button");
            button.className = "roadmap-map-pin";
            button.addEventListener("click", () => {
              const current = latest.current;
              const target =
                group.stops.find(
                  (stop) => stop.item.id === current.selectedItemId,
                ) ??
                group.stops.find(
                  (stop) => stop.dayNumber === current.activeDay,
                ) ??
                group.stops[0];
              current.onSelectItem(target.item.id);
            });
            const marker = new mapboxgl.Marker({
              element: button,
              anchor: "bottom",
            })
              .setLngLat([
                group.coordinate.longitude,
                group.coordinate.latitude,
              ])
              .addTo(instance);
            markers.push({ group, marker, button });
          }
          refresh.current();
          fit.current();
          setStatus("ready");
        });
        instance.on("error", fail);
        observer = new ResizeObserver(() => {
          instance?.resize();
          fit.current();
        });
        observer.observe(element);
      } catch {
        fail();
      }
    }
    void initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      for (const marker of markers) marker.marker.remove();
      startMarker?.remove();
      instance?.remove();
      map.current = null;
      refresh.current = () => {};
      fit.current = () => {};
    };
  }, [token, groups, attempt]);

  const hasMap = Boolean(token);
  const ready = hasMap && status === "ready";
  // Why no pin is drawn; the base map itself is shown either way once a token exists.
  const emptyNote = !stops.length
    ? "Lộ trình chưa có địa điểm để hiển thị."
    : !groups.length
      ? "Chưa có địa điểm đủ tọa độ để hiển thị bản đồ."
      : null;
  const message = !token
    ? (emptyNote ??
      "Bản đồ chưa sẵn sàng. Bạn vẫn có thể xem các điểm trong lộ trình.")
    : status === "error"
      ? errorStatus === 401 || errorStatus === 403
        ? // The provider refused the key: say so, and in development where to look.
          `Dịch vụ bản đồ từ chối khóa truy cập (lỗi ${errorStatus}). Bạn vẫn có thể xem các điểm trong lộ trình.${
            process.env.NODE_ENV === "production"
              ? ""
              : " Kiểm tra NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN trong tài khoản Mapbox rồi chạy lại ứng dụng."
          }`
        : "Chưa tải được bản đồ. Bạn vẫn có thể xem các điểm trong lộ trình."
      : "Đang tải bản đồ…";

  const choices = (
    <ol className="roadmap-map-stop-choices">
      {stops.map((stop) => (
        <li key={stop.item.id}>
          <button
            className="roadmap-map-stop-choice"
            type="button"
            data-tone={(stop.dayNumber - 1) % 5}
            aria-label={`Xem vị trí ${stop.item.dish.name}`}
            aria-pressed={stop.item.id === selectedItemId}
            onClick={() => onSelectItem(stop.item.id)}
          >
            <span>{stop.number}</span>
            <span>
              {stop.item.dish.name}
              <small>
                {stop.dayLabel}
                {!stop.coordinate && " · Chưa có tọa độ"}
              </small>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <aside
      className="roadmap-map-panel"
      role="region"
      aria-label="Bản đồ lộ trình"
      data-ready={ready}
      data-selected={selected !== null}
    >
      <div
        ref={container}
        className="roadmap-map-surface"
        aria-label={`Các địa điểm của ${overview.title}`}
      />
      <div className="roadmap-map-statusbar">
        <span>Ngày {activeDay}</span>
        <span>
          {stops.filter((stop) => stop.coordinate !== null).length}/
          {stops.length} điểm có tọa độ
        </span>
      </div>
      {!ready && (
        <div className="roadmap-map-status" role="status">
          <p>{message}</p>
          {hasMap && status === "error" && (
            <Button
              variant="secondary"
              onClick={() => {
                setStatus("loading");
                setErrorStatus(null);
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại bản đồ
            </Button>
          )}
        </div>
      )}
      {ready && emptyNote && (
        <p className="roadmap-map-note" role="status">
          {emptyNote}
        </p>
      )}
      {itinerary.length > 0 && (
        <div className="roadmap-map-legend" aria-label="Ngày trên bản đồ">
          {itinerary.map((day) => (
            <span
              key={day.dayId}
              className="roadmap-map-legend-day"
              data-tone={(day.dayNumber - 1) % 5}
              data-active={day.dayNumber === activeDay}
            >
              Ngày {day.dayNumber}
            </span>
          ))}
        </div>
      )}
      <div className="roadmap-map-controls">
        <Button
          variant="icon"
          aria-label="Xem ngày đang chọn trên bản đồ"
          disabled={!ready}
          onClick={() => fit.current()}
        >
          <Icon name="LocateFixed" />
        </Button>
        <Button
          variant="icon"
          aria-label="Phóng to bản đồ"
          disabled={!ready}
          onClick={() => map.current?.zoomIn()}
        >
          <Icon name="Plus" />
        </Button>
        <Button
          variant="icon"
          aria-label="Thu nhỏ bản đồ"
          disabled={!ready}
          onClick={() => map.current?.zoomOut()}
        >
          <Icon name="Minus" />
        </Button>
      </div>
      {stops.length > 0 &&
        (ready ? (
          <details className="roadmap-map-stop-list">
            <summary>Các điểm trong lộ trình ({stops.length})</summary>
            {choices}
          </details>
        ) : (
          <div className="roadmap-map-stop-list">{choices}</div>
        ))}
      {selected && (
        <SelectedMapCard
          key={selected.item.id}
          stop={selected}
          coincident={coincident}
          onSelectItem={onSelectItem}
        />
      )}
    </aside>
  );
}
