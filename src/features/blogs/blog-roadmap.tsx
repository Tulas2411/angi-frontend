"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/primitives";
import { dateLabel } from "@/shared/format";
import { restaurantHref } from "@/features/explore/explore-routes";
import { vnd } from "@/features/explore/explore-rules";
import { mealLabels } from "./blog-rules";
import type { RoadmapSnapshotDto } from "./blog-types";

/** The meals of one day, in the order they were captured. */
function groupByMeal(items: RoadmapSnapshotDto["days"][number]["items"]) {
  const groups: { mealSlot: string; items: typeof items }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.mealSlot === item.mealSlot) last.items.push(item);
    else groups.push({ mealSlot: item.mealSlot, items: [item] });
  }
  return groups;
}

/**
 * The roadmap the author shared, as it was on the day it was posted: its title, the days with
 * their meals and prices, and what the whole plan costs. The days open like the roadmap detail.
 */
export function BlogRoadmap({
  snapshot,
  detached,
  covers,
}: {
  snapshot: RoadmapSnapshotDto;
  /** True when the original roadmap was deleted; the snapshot is all that is left. */
  detached: boolean;
  /** The cover photo of each dish, read from the dish catalogue. */
  covers: Record<number, string | null>;
}) {
  const [openDays, setOpenDays] = useState<number[]>([1]);
  const dishes = snapshot.days.reduce((sum, entry) => sum + entry.items.length, 0);
  // What each day and each meal costs, taken from the captured prices.
  const byDay = snapshot.days.map((entry) => ({
    dayNumber: entry.dayNumber,
    cost: entry.items.reduce((sum, item) => sum + item.price, 0),
  }));
  const byMeal = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of snapshot.days)
      for (const item of entry.items)
        totals.set(
          item.mealSlot,
          (totals.get(item.mealSlot) ?? 0) + item.price,
        );
    return [...totals].map(([mealSlot, cost]) => ({ mealSlot, cost }));
  }, [snapshot.days]);

  function toggleDay(dayNumber: number) {
    setOpenDays((current) =>
      current.includes(dayNumber)
        ? current.filter((value) => value !== dayNumber)
        : [...current, dayNumber],
    );
  }

  return (
    <section className="blog-section" aria-labelledby="blog-roadmap">
      <header className="blog-section-head">
        <div>
          <p className="blog-eyebrow">Lộ trình được chia sẻ</p>
          <h2 id="blog-roadmap" className="blog-section-title">
            {snapshot.title}
          </h2>
          <p className="blog-line">
            {snapshot.startDate ? `${dateLabel(snapshot.startDate)} · ` : ""}
            {snapshot.numDays} ngày · {dishes} món · {vnd(snapshot.totalCost)}
          </p>
        </div>
      </header>
      <div className="blog-roadmap-days">
        {snapshot.days.map((day) => {
          const open = openDays.includes(day.dayNumber);
          const cost = day.items.reduce((sum, item) => sum + item.price, 0);
          const bodyId = `blog-day-body-${day.dayNumber}`;
          return (
            <section
              key={day.dayNumber}
              className="blog-roadmap-day"
              aria-labelledby={`blog-day-title-${day.dayNumber}`}
            >
              <h3 id={`blog-day-title-${day.dayNumber}`}>
                <button
                  type="button"
                  className="blog-day-toggle"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => toggleDay(day.dayNumber)}
                >
                  <span className="roadmap-chevron" aria-hidden>
                    <Icon name="roadmap-chevron" />
                  </span>
                  <span>{`Ngày ${day.dayNumber}`}</span>
                </button>
              </h3>
              <p className="blog-day-sub">
                {open
                  ? `Ngày ${day.dayNumber} · ${
                      day.items.length
                        ? `${day.items.length} món · ${vnd(cost)}`
                        : "Chưa có món"
                    }`
                  : day.items.map((item) => item.dishName).join(" · ")}
              </p>
              {open && (
                <div id={bodyId} className="blog-day-body">
                  {day.items.length ? (
                    groupByMeal(day.items).map((group) => (
                      <div
                        key={group.mealSlot}
                        className="blog-meal"
                        data-meal={group.mealSlot}
                      >
                        <div className="blog-meal-header">
                          <h4 className="blog-meal-heading">
                            {mealLabels[group.mealSlot] ?? group.mealSlot}
                          </h4>
                        </div>
                        <ol className="blog-meal-items">
                          {group.items.map((item, index) => (
                            <li key={`${item.dishId}-${index}`}>
                              <div className="blog-meal-item">
                                <div className="blog-meal-text">
                                  <h5>
                                    <span className="blog-meal-order" aria-hidden>
                                      {index + 1}
                                    </span>
                                    {item.dishName}
                                  </h5>
                                  <p className="blog-meal-price">
                                    Dự chi {vnd(item.price)}
                                  </p>
                                  <p className="helper">
                                    <Link href={restaurantHref(item.restaurantId)}>
                                      {item.restaurantName}
                                    </Link>
                                    {item.address && ` · ${item.address}`}
                                  </p>
                                </div>
                                {covers[item.dishId] && (
                                  <div className="blog-meal-media">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={covers[item.dishId] ?? undefined}
                                      alt={item.dishName}
                                      loading="lazy"
                                    />
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))
                  ) : (
                    <p className="helper">Ngày này chưa có món nào.</p>
                  )}
                  {day.items.length > 0 && (
                    <p className="blog-day-total">
                      Tổng dự chi hôm nay: <strong>{vnd(cost)}</strong>. Giá tính
                      theo giá lúc đăng bài.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="blog-roadmap-costs">
        <div className="blog-cost-block">
          <h3>Chi phí theo ngày</h3>
          <dl className="detail-list">
            {byDay.map((entry) => (
              <div key={entry.dayNumber}>
                <dt>Ngày {entry.dayNumber}</dt>
                <dd>{vnd(entry.cost)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="blog-cost-block">
          <h3>Chi phí theo bữa</h3>
          <dl className="detail-list">
            {byMeal.map((entry) => (
              <div key={entry.mealSlot}>
                <dt>{mealLabels[entry.mealSlot] ?? entry.mealSlot}</dt>
                <dd>{vnd(entry.cost)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="blog-line">
        Chụp lại lúc đăng bài
        {detached ? ", lộ trình gốc đã bị xóa" : ""}. Giá và quán có thể đã thay
        đổi.
      </p>
    </section>
  );
}

/** The restaurants of the shared roadmap, with the coordinates the map needs. */
export function useBlogRoadmapStops(
  snapshot: RoadmapSnapshotDto | null,
  fetchRestaurant: (restaurantId: number) => Promise<{
    latitude: number | null;
    longitude: number | null;
  }>,
) {
  const [places, setPlaces] = useState<
    Record<number, { latitude: number; longitude: number } | null>
  >({});
  const ids = useMemo(
    () =>
      [
        ...new Set(
          (snapshot?.days ?? []).flatMap((entry) =>
            entry.items.map((item) => item.restaurantId),
          ),
        ),
      ].sort((a, b) => a - b),
    [snapshot],
  );
  // The fetcher is a stable service call; it is read through a ref so a new
  // function identity never re-reads the restaurants.
  const fetchRef = useRef(fetchRestaurant);
  useEffect(() => {
    fetchRef.current = fetchRestaurant;
  });
  useEffect(() => {
    if (!ids.length) return;
    let ignore = false;
    Promise.all(
      ids.map(async (restaurantId) => {
        try {
          const restaurant = await fetchRef.current(restaurantId);
          if (restaurant.latitude === null || restaurant.longitude === null)
            return { restaurantId, place: null };
          return {
            restaurantId,
            place: {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            },
          };
        } catch {
          // A restaurant that cannot be read is simply not on the map.
          return { restaurantId, place: null };
        }
      }),
    ).then((restaurants) => {
      if (ignore) return;
      setPlaces(
        Object.fromEntries(
          restaurants.map((entry) => [entry.restaurantId, entry.place]),
        ),
      );
    });
    return () => {
      ignore = true;
    };
  }, [ids]);
  // The pins follow the days and the dishes of the snapshot, in their order.
  return useMemo(
    () =>
      (snapshot?.days ?? []).flatMap((day) =>
        day.items.flatMap((item, index) => {
          const place = places[item.restaurantId];
          if (!place) return [];
          return [
            {
              id: `${item.restaurantId}-${day.dayNumber}-${index}`,
              label: item.dishName,
              dayNumber: day.dayNumber,
              mealSlot: item.mealSlot,
              latitude: place.latitude,
              longitude: place.longitude,
            },
          ];
        }),
      ),
    [places, snapshot],
  );
}

/**
 * The cover photo of each dish of the shared roadmap, read from the dish catalogue.
 * A dish that cannot be read simply has no photo.
 */
export function useBlogDishCovers(
  snapshot: RoadmapSnapshotDto | null,
  fetchDish: (dishId: number) => Promise<{ coverUrl: string | null }>,
) {
  const [covers, setCovers] = useState<Record<number, string | null>>({});
  const ids = useMemo(
    () =>
      [
        ...new Set(
          (snapshot?.days ?? []).flatMap((entry) =>
            entry.items.map((item) => item.dishId),
          ),
        ),
      ].sort((a, b) => a - b),
    [snapshot],
  );
  // The fetcher is a stable service call; it is read through a ref so a new
  // function identity never re-reads the dishes.
  const fetchRef = useRef(fetchDish);
  useEffect(() => {
    fetchRef.current = fetchDish;
  });
  useEffect(() => {
    if (!ids.length) return;
    let ignore = false;
    Promise.all(
      ids.map(async (dishId) => {
        try {
          const dish = await fetchRef.current(dishId);
          return { dishId, coverUrl: dish.coverUrl };
        } catch {
          return { dishId, coverUrl: null };
        }
      }),
    ).then((dishes) => {
      if (ignore) return;
      setCovers(
        Object.fromEntries(
          dishes.map((entry) => [entry.dishId, entry.coverUrl]),
        ),
      );
    });
    return () => {
      ignore = true;
    };
  }, [ids]);
  return covers;
}
