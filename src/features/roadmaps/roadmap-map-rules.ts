import { isMapLocation } from "@/shared/maps/mapbox";
import { dayShortLabel } from "./roadmap-detail-rules";
import type {
  RoadmapDayDto,
  RoadmapItemDto,
  RoadmapRouteDto,
} from "./roadmap-types";

export interface RoadmapMapCoordinate {
  latitude: number;
  longitude: number;
}

export interface RoadmapMapStop {
  item: RoadmapItemDto;
  dayNumber: number;
  dayLabel: string;
  number: number;
  coordinate: RoadmapMapCoordinate | null;
}

export interface RoadmapMapGroup<Stop = RoadmapMapStop> {
  key: string;
  coordinate: RoadmapMapCoordinate;
  stops: Stop[];
}

/** One color per day (`--map-day-color`); a roadmap has at most 7 days, so no two days share one. */
export const roadmapDayTone = (dayNumber: number) => (dayNumber - 1) % 7;

export function roadmapMapCoordinate(
  latitude: number | null,
  longitude: number | null,
): RoadmapMapCoordinate | null {
  if (latitude === null || longitude === null) return null;
  const point = { latitude, longitude };
  return isMapLocation(point) ? point : null;
}

/** Stop numbers preserve each day's backend order, including items without coordinates. */
export function roadmapMapStops(
  itinerary: readonly RoadmapDayDto[],
): RoadmapMapStop[] {
  return itinerary.flatMap((day) =>
    day.items.map((item, index) => ({
      item,
      dayNumber: day.dayNumber,
      dayLabel: dayShortLabel(day),
      number: index + 1,
      coordinate: roadmapMapCoordinate(
        item.dish.restaurant.latitude,
        item.dish.restaurant.longitude,
      ),
    })),
  );
}

/** Repeated restaurant coordinates share one marker; coordinates are never offset or rounded. */
export function groupRoadmapStops<
  Stop extends { coordinate: RoadmapMapCoordinate | null },
>(stops: readonly Stop[]): RoadmapMapGroup<Stop>[] {
  const groups = new Map<string, RoadmapMapGroup<Stop>>();
  for (const stop of stops) {
    if (!stop.coordinate) continue;
    const { latitude, longitude } = stop.coordinate;
    const key = `${longitude}:${latitude}`;
    const group = groups.get(key);
    if (group) group.stops.push(stop);
    else groups.set(key, { key, coordinate: stop.coordinate, stops: [stop] });
  }
  return [...groups.values()];
}

/** Fit the active day, or the other actual stops when that day has no located item. */
export function roadmapMapPoints(
  stops: readonly Pick<RoadmapMapStop, "coordinate" | "dayNumber">[],
  activeDay: number,
  origin?: RoadmapRouteDto["origin"],
  originSkipped = false,
): [number, number][] {
  const located = stops.filter((stop) => stop.coordinate !== null);
  // The route origin belongs to the saved roadmap; callers omit it for a preview.
  const active = located.filter((stop) => stop.dayNumber === activeDay);
  const points: [number, number][] = (active.length ? active : located).flatMap(
    (stop) =>
      stop.coordinate
        ? [
            [stop.coordinate.longitude, stop.coordinate.latitude] as [
              number,
              number,
            ],
          ]
        : [],
  );
  const start =
    origin && !originSkipped
      ? roadmapMapCoordinate(origin.latitude, origin.longitude)
      : null;
  if (start) points.unshift([start.longitude, start.latitude]);
  return points.filter(
    (point, index) =>
      points.findIndex(
        (other) => other[0] === point[0] && other[1] === point[1],
      ) === index,
  );
}

/** Street level: the selected restaurant and the streets around it. */
export const roadmapFocusZoom = 16;

/**
 * Camera offset (pixels from the canvas centre, Mapbox `easeTo` `offset`) that shows a selected
 * stop in the middle of the part of the map nobody covers: under the day bar at the top, above
 * the place card (or the assistant popup) at the bottom, left of the zoom buttons. When the card
 * leaves too little room, the stop goes halfway between the top bar and the bottom edge.
 */
export function roadmapFocusOffset(
  view: { width: number; height: number },
  covered: { top: number; bottom: number; right: number },
): [number, number] {
  const top = Math.max(0, Math.min(covered.top, view.height));
  const bottomEdge = view.height - Math.max(0, covered.bottom);
  const visibleBottom = bottomEdge - top >= 80 ? bottomEdge : view.height;
  const right = Math.max(0, Math.min(covered.right, view.width / 2));
  // `|| 0` turns a rounded -0 into 0.
  return [
    Math.round(-right / 2) || 0,
    Math.round((top + visibleBottom) / 2 - view.height / 2) || 0,
  ];
}
