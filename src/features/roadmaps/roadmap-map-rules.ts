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

export interface RoadmapMapGroup {
  key: string;
  coordinate: RoadmapMapCoordinate;
  stops: RoadmapMapStop[];
}

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
export function groupRoadmapStops(
  stops: readonly RoadmapMapStop[],
): RoadmapMapGroup[] {
  const groups = new Map<string, RoadmapMapGroup>();
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
  stops: readonly RoadmapMapStop[],
  activeDay: number,
  origin?: RoadmapRouteDto["origin"],
  originSkipped = false,
): [number, number][] {
  const located = stops.filter((stop) => stop.coordinate !== null);
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
