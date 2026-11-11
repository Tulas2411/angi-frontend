"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Button } from "@/shared/ui";
import { Icon } from "@/components/ui/primitives";
import { mapStyles } from "@/shared/maps/mapbox";
import { mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import { RoadmapPlaceCard } from "./roadmap-place-card";
import {
  agentDishName,
  type AgentMapPreview,
  type AgentMapStop,
} from "./agent-map-rules";
import {
  groupRoadmapStops,
  roadmapDayTone,
  roadmapFocusOffset,
  roadmapFocusZoom,
  roadmapMapCoordinate,
  roadmapMapPoints,
  roadmapMapStops,
  type RoadmapMapGroup,
} from "./roadmap-map-rules";
import type {
  RoadmapDayDto,
  RoadmapRouteDto,
  RoadmapSummaryDto,
} from "./roadmap-types";
import "mapbox-gl/dist/mapbox-gl.css";

/** Shown when nothing is located yet: the whole country, like the owner location picker. */
const vietnamView = { center: [106.2, 16.3] as [number, number], zoom: 4.6 };
/** How long Mapbox may take to say "load" before the panel offers "Thử lại bản đồ". */
const mapLoadTimeoutMs = 20_000;
/** Automatic rebuilds after the browser drops the WebGL context, before asking the traveler. */
const maxContextRebuilds = 2;

/** A preview dish on the map. Previews carry no rating or photo, so only their real fields are shown. */
function PreviewMapCard({
  stop,
  coincident,
  onSelect,
}: {
  stop: AgentMapStop;
  coincident: readonly AgentMapStop[];
  onSelect: (itemKey: string) => void;
}) {
  return (
    <section className="roadmap-map-card" aria-label="Món trong bản nháp">
      <div className="roadmap-map-card-heading">
        <span className="roadmap-map-included">
          {stop.changed ? "Món mới trong bản nháp" : "Có trong bản nháp"}
        </span>
        <Button
          variant="icon"
          aria-label="Đóng thông tin món"
          onClick={() => onSelect("")}
        >
          <Icon name="X" />
        </Button>
      </div>
      <div className="roadmap-map-card-body">
        {/* At most two lines (a long name would grow the card over the map); full name on hover. */}
        <h3
          className="roadmap-map-card-title"
          title={stop.item.restaurantName ?? undefined}
        >
          {stop.item.restaurantName ?? "Chưa có tên quán"}
        </h3>
        <p className="helper">
          Ngày {stop.dayNumber} · {mealSlotLabels[stop.item.mealSlot]} · Điểm{" "}
          {stop.number}
        </p>
        <p>
          {agentDishName(stop.item)} · Dự chi {vnd(stop.item.price)}
        </p>
        {!stop.coordinate && (
          <p className="helper">Món này chưa có vị trí trên bản đồ.</p>
        )}
        {coincident.length > 1 && (
          <div className="roadmap-map-coincident">
            <p className="helper">{coincident.length} món cùng vị trí</p>
            {coincident.map((point) => (
              <button
                key={point.item.itemKey}
                type="button"
                aria-pressed={point.item.itemKey === stop.item.itemKey}
                onClick={() => onSelect(point.item.itemKey)}
              >
                Ngày {point.dayNumber} · {point.number}.{" "}
                {agentDishName(point.item)}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const svgNamespace = "http://www.w3.org/2000/svg";
/** The drop of the itinerary cards' pin (`.roadmap-item-pin`), so both pins look the same. */
const pinPath =
  "M12 1C5.9 1 1 5.8 1 11.8 1 19.9 12 31 12 31s11-11.1 11-19.2C23 5.8 18.1 1 12 1z";

/**
 * Writes the pin's number ("3", or "3+1" for dishes sharing a place). The drop is drawn once and
 * kept; only the number changes, and it is the button's only text.
 */
function setPinNumber(button: HTMLButtonElement, text: string) {
  let label = button.querySelector<HTMLSpanElement>(".roadmap-map-pin-number");
  if (!label) {
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 32");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", pinPath);
    svg.append(path);
    label = document.createElement("span");
    label.className = "roadmap-map-pin-number";
    button.replaceChildren(svg, label);
  }
  label.textContent = text;
  button.dataset.wide = String(text.length > 2);
}

/** Paints one preview pin; a pin holding several dishes shows the selected or active-day one first. */
function paintPreviewPin(
  group: RoadmapMapGroup<AgentMapStop>,
  button: HTMLButtonElement,
  activeDay: number,
  selectedKey: string,
) {
  const representative =
    group.stops.find((stop) => stop.item.itemKey === selectedKey) ??
    group.stops.find((stop) => stop.dayNumber === activeDay) ??
    group.stops[0];
  const isSelected = group.stops.some(
    (stop) => stop.item.itemKey === selectedKey,
  );
  button.dataset.tone = String(roadmapDayTone(representative.dayNumber));
  button.dataset.active = String(
    group.stops.some((stop) => stop.dayNumber === activeDay),
  );
  button.dataset.selected = String(isSelected);
  button.dataset.changed = String(group.stops.some((stop) => stop.changed));
  setPinNumber(
    button,
    group.stops.length > 1
      ? `${representative.number}+${group.stops.length - 1}`
      : String(representative.number),
  );
  button.setAttribute(
    "aria-label",
    group.stops.length > 1
      ? `${group.stops.length} món trong bản nháp cùng vị trí: ${group.stops.map((stop) => `${agentDishName(stop.item)}, ngày ${stop.dayNumber}`).join("; ")}`
      : `Bản nháp, điểm ${representative.number}, ngày ${representative.dayNumber}: ${agentDishName(representative.item)}${representative.changed ? ", món mới" : ""}`,
  );
  button.setAttribute("aria-pressed", String(isSelected));
}

/**
 * Read-only RM-03 stop map; while the assistant shows a preview it draws that preview's stops instead.
 * It never searches places or requests route geometry.
 */
export function RoadmapDetailMap({
  overview,
  itinerary,
  activeDay,
  selectedItemId,
  onSelectItem,
  origin,
  originSkipped = false,
  preview = null,
  agentPopupOpen = false,
  onOpenAgent,
  fallbackCenter = null,
}: {
  overview: RoadmapSummaryDto;
  itinerary: RoadmapDayDto[];
  activeDay: number;
  selectedItemId: number | null;
  onSelectItem: (id: number | null) => void;
  origin?: RoadmapRouteDto["origin"];
  originSkipped?: boolean;
  preview?: AgentMapPreview | null;
  /** The assistant's popup sits over the map's lower part, so stops are fitted above it. */
  agentPopupOpen?: boolean;
  /** Omitted while the assistant is open. */
  onOpenAgent?: () => void;
  /**
   * Where the map opens, and where "locate" goes, when there is nothing to show yet (no located
   * dish, no pinned start): the centre of the destination city.
   */
  fallbackCenter?: { latitude: number; longitude: number } | null;
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
  const previewStops = preview?.stops ?? null;
  const previewDay = preview?.activeDay ?? null;
  const previewKey = preview?.selectedKey ?? "";
  const previewGroups = useMemo(
    () => (previewStops ? groupRoadmapStops(previewStops) : []),
    [previewStops],
  );
  const previewSelected =
    previewStops?.find((stop) => stop.item.itemKey === previewKey) ?? null;
  const previewCoincident = previewSelected?.coordinate
    ? (previewGroups.find((group) =>
        group.stops.some(
          (stop) => stop.item.itemKey === previewSelected.item.itemKey,
        ),
      )?.stops ?? [])
    : [];
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const mapbox = useRef<typeof import("mapbox-gl").default | null>(null);
  const previewPins = useRef<
    { group: RoadmapMapGroup<AgentMapStop>; button: HTMLButtonElement }[]
  >([]);
  const refresh = useRef<() => void>(() => {});
  // `focus: false` frames the whole day even while a stop is selected (the "locate" button).
  const fit = useRef<(options?: { focus?: boolean }) => void>(() => {});
  /** Draws the pins of the current stops again on the same map. */
  const sync = useRef<() => void>(() => {});
  const latest = useRef({
    overview,
    stops,
    groups,
    activeDay,
    selectedItemId,
    onSelectItem,
    origin,
    originSkipped,
    preview,
    fallbackCenter,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  // WebGL contexts lost so far; reset by "Thử lại bản đồ".
  const contextLosses = useRef(0);
  // Counts completed map loads, so preview pins are drawn again on a replaced map instance.
  const [loadedMaps, setLoadedMaps] = useState(0);
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
      preview,
      fallbackCenter,
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
    preview,
    fallbackCenter,
  ]);

  // New stops (a dish added, removed or moved) redraw the pins; the map itself stays.
  useEffect(() => {
    sync.current();
  }, [groups]);

  useEffect(() => {
    refresh.current();
    fit.current();
  }, [
    groups,
    activeDay,
    selectedItemId,
    origin,
    originSkipped,
    previewStops,
    previewDay,
    previewKey,
    agentPopupOpen,
  ]);

  // The place card grows once its details load: fit again, or it would cover the lowest pins.
  const hasCard = preview ? previewKey !== "" : selectedItemId !== null;
  useEffect(() => {
    const card =
      container.current?.parentElement?.querySelector(".roadmap-map-card");
    if (!hasCard || !card) return;
    let height = card.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const next = card.getBoundingClientRect().height;
      if (next === height) return;
      height = next;
      fit.current();
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [hasCard, selectedItemId, previewKey]);

  // Preview pins join the mounted map instead of recreating it, so a new preview loads no extra map.
  useEffect(() => {
    const instance = map.current;
    const provider = mapbox.current;
    if (!loadedMaps || !instance || !provider) return;
    const pins = previewGroups.map((group) => {
      const button = document.createElement("button");
      button.type = "button";
      // Mapbox otherwise assigns role="img", overriding native button semantics.
      button.setAttribute("role", "button");
      button.className = "roadmap-map-pin roadmap-map-pin-preview";
      button.addEventListener("click", () => {
        const current = latest.current.preview;
        if (!current) return;
        const target =
          group.stops.find(
            (stop) => stop.item.itemKey === current.selectedKey,
          ) ??
          group.stops.find((stop) => stop.dayNumber === current.activeDay) ??
          group.stops[0];
        current.onSelect(target.item.itemKey);
      });
      const current = latest.current.preview;
      paintPreviewPin(
        group,
        button,
        current?.activeDay ?? 1,
        current?.selectedKey ?? "",
      );
      const marker = new provider.Marker({ element: button, anchor: "bottom" })
        .setLngLat([group.coordinate.longitude, group.coordinate.latitude])
        .addTo(instance);
      return { group, button, marker };
    });
    previewPins.current = pins;
    fit.current();
    return () => {
      previewPins.current = [];
      for (const pin of pins) pin.marker.remove();
    };
  }, [previewGroups, loadedMaps]);
  useEffect(() => {
    for (const { group, button } of previewPins.current)
      paintPreviewPin(group, button, previewDay ?? 1, previewKey);
  }, [previewDay, previewKey]);

  useEffect(() => {
    // The base map is drawn even before any dish has coordinates; pins appear with them.
    if (!token || !container.current) return;
    const element = container.current;
    let disposed = false;
    let instance: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    let startMarker: Marker | null = null;
    let loaded = false;
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
      // Once drawn, a passing failure (one tile, one sprite) keeps the map: only a refused key
      // ends it. Removing a working map would also cost another map load.
      if (loaded && code !== 401 && code !== 403) return;
      setErrorStatus(typeof code === "number" ? code : null);
      setStatus("error");
      observer?.disconnect();
      instance?.remove();
      instance = null;
      map.current = null;
    };

    /**
     * Resolves once the surface has a real size. A map created in a 0 × 0 box (the page's CSS not
     * applied yet, a hidden column) keeps an empty canvas and puts every pin outside it: the panel
     * stays blank until a reload.
     */
    const sized = () =>
      new Promise<void>((resolve) => {
        if (element.clientWidth > 0 && element.clientHeight > 0) {
          resolve();
          return;
        }
        const watcher = new ResizeObserver(() => {
          if (
            disposed ||
            (element.clientWidth > 0 && element.clientHeight > 0)
          ) {
            watcher.disconnect();
            resolve();
          }
        });
        watcher.observe(element);
      });

    async function initialize() {
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        if (disposed) return;
        await sized();
        if (disposed) return;
        mapbox.current = mapboxgl;
        const current = latest.current;
        const pinned =
          current.overview.originMode === "pinned"
            ? roadmapMapCoordinate(
                current.overview.originLatitude,
                current.overview.originLongitude,
              )
            : null;
        // First a located stop, then the pinned origin, then the destination city, else the
        // whole of Vietnam.
        const located = roadmapMapPoints(
          current.stops,
          current.activeDay,
          current.origin,
          current.originSkipped,
        )[0];
        const city = current.fallbackCenter;
        const initial =
          located ??
          (pinned
            ? ([pinned.longitude, pinned.latitude] as [number, number])
            : city
              ? ([city.longitude, city.latitude] as [number, number])
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
          // No performance metrics to events.mapbox.com: ad blockers refuse them, which only filled
          // the console with ERR_BLOCKED_BY_CLIENT. Map load events, needed by Mapbox, still go.
          performanceMetricsCollection: false,
        });
        map.current = instance;
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();

        fit.current = ({ focus = true } = {}) => {
          if (!instance || disposed) return;
          // A responsive map panel may be hidden until the traveler opens it.
          if (element.clientWidth === 0 || element.clientHeight === 0) return;
          // The selected card and responsive columns can resize the CSS box
          // before ResizeObserver runs; fit against the current canvas size.
          instance.resize();
          const current = latest.current;
          // A selected stop with a pin: zoom in on it and show it in the middle of the uncovered
          // part of the map, between the day bar and the place card (the card covers the centre).
          const selected = current.preview
            ? current.preview.stops.find(
                (stop) => stop.item.itemKey === current.preview?.selectedKey,
              )?.coordinate
            : current.stops.find(
                (stop) => stop.item.id === current.selectedItemId,
              )?.coordinate;
          if (focus && selected) {
            const box = element.getBoundingClientRect();
            const panel = element.parentElement;
            const bottomOf = (selector: string) =>
              panel
                ?.querySelector<HTMLElement>(selector)
                ?.getBoundingClientRect().bottom ?? box.top;
            const card = panel?.querySelector<HTMLElement>(".roadmap-map-card");
            const popup = document.querySelector<HTMLElement>(
              '.roadmap-agent-panel[data-open="true"][data-mode="popup"]',
            );
            const controls = panel?.querySelector<HTMLElement>(
              ".roadmap-map-controls",
            );
            const coveredFrom = (overlay: HTMLElement | null | undefined) =>
              overlay ? box.bottom - overlay.getBoundingClientRect().top : 0;
            const offset = roadmapFocusOffset(
              { width: box.width, height: box.height },
              {
                top:
                  Math.max(
                    bottomOf(".roadmap-map-statusbar"),
                    bottomOf(".roadmap-map-legend"),
                  ) - box.top,
                bottom: Math.max(coveredFrom(card), coveredFrom(popup)),
                right: controls
                  ? box.right - controls.getBoundingClientRect().left
                  : 0,
              },
            );
            instance.easeTo({
              center: [selected.longitude, selected.latitude],
              // Never zooms back out when the traveler is already closer.
              zoom: Math.max(instance.getZoom(), roadmapFocusZoom),
              offset,
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              duration: reducedMotion() ? 0 : 420,
            });
            return;
          }
          const points = current.preview
            ? roadmapMapPoints(current.preview.stops, current.preview.activeDay)
            : roadmapMapPoints(
                current.stops,
                current.activeDay,
                current.origin,
                current.originSkipped,
              );
          const hasSelection = current.preview
            ? current.preview.selectedKey !== ""
            : current.selectedItemId !== null;
          if (!points.length) {
            // Nothing to frame: "locate" goes to the destination city, if one is known.
            const city = current.fallbackCenter;
            if (!focus && city && !current.preview)
              instance.easeTo({
                center: [city.longitude, city.latitude],
                zoom: 12,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                duration: reducedMotion() ? 0 : 360,
              });
            return;
          }
          const cardHeight =
            element.parentElement?.querySelector<HTMLElement>(
              ".roadmap-map-card",
            )?.offsetHeight ?? 0;
          const popupHeight =
            document.querySelector<HTMLElement>(
              '.roadmap-agent-panel[data-open="true"][data-mode="popup"]',
            )?.offsetHeight ?? 0;
          const topPadding = hasSelection ? 208 : 176;
          const bottomPadding = Math.min(
            Math.max(hasSelection ? cardHeight + 40 : 80, popupHeight + 32),
            Math.max(0, element.clientHeight - topPadding - 48),
          );
          // The card's room is worked into the target camera, never kept as map padding: a large
          // padding left in the transform stops Mapbox from loading the tiles behind it (grey map).
          const noPadding = { top: 0, right: 0, bottom: 0, left: 0 };
          const duration = reducedMotion() ? 0 : 360;
          if (points.length === 1)
            instance.easeTo({
              center: points[0],
              zoom: 14,
              offset: [0, (topPadding - bottomPadding) / 2],
              padding: noPadding,
              duration,
            });
          else {
            const bounds = new mapboxgl.LngLatBounds(points[0], points[0]);
            for (const point of points.slice(1)) bounds.extend(point);
            const camera = instance.cameraForBounds(bounds, {
              padding: {
                top: topPadding,
                right: 84,
                left: 44,
                bottom: bottomPadding,
              },
              maxZoom: 15,
            });
            instance.easeTo({
              // Too little room left for the padding: centre the stops instead.
              ...(camera ?? { center: bounds.getCenter() }),
              padding: noPadding,
              duration,
            });
          }
        };

        refresh.current = () => {
          if (!instance || disposed) return;
          const current = latest.current;
          for (const { group, button } of markers) {
            button.hidden = current.preview !== null;
            const representative =
              group.stops.find(
                (stop) => stop.item.id === current.selectedItemId,
              ) ??
              group.stops.find(
                (stop) => stop.dayNumber === current.activeDay,
              ) ??
              group.stops[0];
            button.dataset.tone = String(
              roadmapDayTone(representative.dayNumber),
            );
            button.dataset.active = String(
              group.stops.some((stop) => stop.dayNumber === current.activeDay),
            );
            button.dataset.selected = String(
              group.stops.some(
                (stop) => stop.item.id === current.selectedItemId,
              ),
            );
            setPinNumber(
              button,
              group.stops.length > 1
                ? `${representative.number}+${group.stops.length - 1}`
                : String(representative.number),
            );
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
            current.origin && !current.originSkipped && !current.preview
              ? roadmapMapCoordinate(
                  current.origin.latitude,
                  current.origin.longitude,
                )
              : null;
          if (start) {
            // The same drop as the dishes' pins, in ink, with a white dot in its head instead of
            // a number; its tip (bottom anchor) is the pinned point.
            const pin = document.createElement("span");
            pin.className = "roadmap-map-origin";
            pin.setAttribute("role", "img");
            pin.setAttribute(
              "aria-label",
              current.origin?.label || "Điểm xuất phát",
            );
            const svg = document.createElementNS(svgNamespace, "svg");
            svg.setAttribute("viewBox", "0 0 24 32");
            svg.setAttribute("aria-hidden", "true");
            const drop = document.createElementNS(svgNamespace, "path");
            drop.setAttribute("d", pinPath);
            const dot = document.createElementNS(svgNamespace, "circle");
            dot.setAttribute("cx", "12");
            dot.setAttribute("cy", "11.8");
            dot.setAttribute("r", "4.2");
            svg.append(drop, dot);
            pin.append(svg);
            startMarker = new mapboxgl.Marker({
              element: pin,
              anchor: "bottom",
            })
              .setLngLat([start.longitude, start.latitude])
              .addTo(instance);
          }
        };

        sync.current = () => {
          if (!instance || disposed || !loaded) return;
          for (const { marker } of markers) marker.remove();
          markers.length = 0;
          for (const group of latest.current.groups) {
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
        };

        // Mapbox never said "load" (a stalled style or tile request): an error with "Thử lại",
        // not an endless blank panel.
        const loadTimer = window.setTimeout(() => {
          if (!loaded) fail();
        }, mapLoadTimeoutMs);
        instance.on("load", () => {
          window.clearTimeout(loadTimer);
          if (!instance || disposed) return;
          loaded = true;
          sync.current();
          fit.current();
          setStatus("ready");
          setLoadedMaps((value) => value + 1);
          // The layout can still settle in the same frame (columns, the place card): measure again.
          requestAnimationFrame(() => {
            if (!instance || disposed) return;
            instance.resize();
            fit.current();
          });
        });
        instance.on("error", fail);
        // The browser took the WebGL context back (too many maps, a GPU reset): the canvas goes
        // blank for good. Build the map again, a couple of times, then offer "Thử lại".
        instance.on("webglcontextlost", () => {
          if (disposed) return;
          window.clearTimeout(loadTimer);
          if (contextLosses.current >= maxContextRebuilds) {
            loaded = false;
            fail();
            return;
          }
          contextLosses.current += 1;
          setStatus("loading");
          setAttempt((value) => value + 1);
        });
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
      sync.current = () => {};
    };
    // Created once per token (and per retry): Mapbox shares one telemetry/session sender between
    // maps, and removing a map while its request is pending makes that sender call a cleared
    // callback ("this.errorCb is not a function") when the request fails. It is also a new map load.
  }, [token, attempt]);

  const hasMap = Boolean(token);
  const ready = hasMap && status === "ready";
  // Mapbox is still loading: show that, not the fallback layout of a map that cannot be shown.
  const loading = hasMap && status === "loading";
  const legendDays = preview
    ? preview.days
    : itinerary.map((day) => day.dayNumber);
  const listedCount = previewStops?.length ?? stops.length;
  const locatedCount = previewStops
    ? previewStops.filter((stop) => stop.coordinate !== null).length
    : stops.filter((stop) => stop.coordinate !== null).length;
  // Why no pin is drawn; the base map itself is shown either way once a token exists.
  const emptyNote = !listedCount
    ? `${previewStops ? "Bản nháp" : "Lộ trình"} chưa có địa điểm để hiển thị.`
    : !locatedCount
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
      : "";

  const previewChoices = previewStops && (
    <ol className="roadmap-map-stop-choices">
      {previewStops.map((stop) => (
        <li key={stop.item.itemKey}>
          <button
            className="roadmap-map-stop-choice"
            type="button"
            data-tone={roadmapDayTone(stop.dayNumber)}
            data-changed={stop.changed}
            aria-label={`Xem vị trí ${agentDishName(stop.item)}`}
            aria-pressed={stop.item.itemKey === previewKey}
            onClick={() => preview?.onSelect(stop.item.itemKey)}
          >
            <span>{stop.number}</span>
            <span>
              {agentDishName(stop.item)}
              <small>
                Ngày {stop.dayNumber}
                {stop.changed && " · Món mới"}
                {!stop.coordinate && " · Chưa có tọa độ"}
              </small>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
  const choices = (
    <ol className="roadmap-map-stop-choices">
      {stops.map((stop) => (
        <li key={stop.item.id}>
          <button
            className="roadmap-map-stop-choice"
            type="button"
            data-tone={roadmapDayTone(stop.dayNumber)}
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
      data-loading={loading || undefined}
      data-preview={preview !== null}
      data-selected={preview ? previewSelected !== null : selected !== null}
    >
      <div
        ref={container}
        className="roadmap-map-surface"
        aria-label={`Các địa điểm của ${overview.title}`}
      />
      <div className="roadmap-map-statusbar">
        <span>
          {preview
            ? `Bản nháp · Ngày ${preview.activeDay}`
            : `Ngày ${activeDay}`}
        </span>
        <span>
          {locatedCount}/{listedCount} điểm có tọa độ
        </span>
      </div>
      {loading && (
        <div className="roadmap-map-loading" role="status">
          <span className="spinner" aria-hidden />
          <p>Đang tải bản đồ…</p>
        </div>
      )}
      {!ready && !loading && (
        <div className="roadmap-map-status" role="status">
          <p>{message}</p>
          {hasMap && status === "error" && (
            <Button
              variant="secondary"
              onClick={() => {
                setStatus("loading");
                setErrorStatus(null);
                contextLosses.current = 0;
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
      {legendDays.length > 0 && (
        <div className="roadmap-map-legend" aria-label="Ngày trên bản đồ">
          {legendDays.map((day) => (
            <span
              key={day}
              className="roadmap-map-legend-day"
              data-tone={roadmapDayTone(day)}
              data-active={day === (preview?.activeDay ?? activeDay)}
            >
              Ngày {day}
            </span>
          ))}
        </div>
      )}
      <div className="roadmap-map-controls">
        <Button
          variant="icon"
          aria-label="Xem ngày đang chọn trên bản đồ"
          disabled={!ready}
          onClick={() => fit.current({ focus: false })}
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
      {/*
       * A drawn map is chosen from by its pins and the itinerary's "Xem vị trí" buttons, so it has
       * no stop list (removed 2026-11-04). Without a map (no token, load error) the list is the
       * only way to pick a stop, so it stays.
       */}
      {listedCount > 0 && !loading && !ready && (
        <div className="roadmap-map-stop-list">{previewChoices ?? choices}</div>
      )}
      {onOpenAgent && (
        <Button
          className="roadmap-map-fab"
          aria-label="Mở trợ lý món ăn"
          title="Trợ lý món ăn"
          onClick={onOpenAgent}
        >
          <SparklesIcon aria-hidden />
        </Button>
      )}
      {preview
        ? previewSelected && (
            <PreviewMapCard
              key={previewSelected.item.itemKey}
              stop={previewSelected}
              coincident={previewCoincident}
              onSelect={preview.onSelect}
            />
          )
        : selected && (
            <RoadmapPlaceCard
              key={selected.item.id}
              stop={selected}
              coincident={coincident}
              onSelectItem={onSelectItem}
            />
          )}
    </aside>
  );
}
