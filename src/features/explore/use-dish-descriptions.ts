"use client";
import { useEffect, useRef, useState } from "react";
import type { ExploreService } from "./explore-service";

/**
 * A list card (DISH-01, REST-01) has no description; it is read from the detail operation
 * (DISH-02, REST-02) for the cards on screen.
 */
export type DishDescription =
  | { status: "loading" }
  | { status: "ready"; text: string | null }
  | { status: "error" };

/** Reads at a time, so a long page does not open dozens of requests at once. */
const parallel = 4;
const loading: DishDescription = { status: "loading" };

/**
 * Descriptions of the listed items, loaded once a layout shows them and kept while the page
 * lives: switching layouts or loading more never asks twice for the same item.
 */
function useDescriptions(
  read: (id: number) => Promise<{ description: string | null }>,
  ids: readonly number[],
  enabled: boolean,
) {
  const [known, setKnown] = useState<ReadonlyMap<number, DishDescription>>(
    () => new Map(),
  );
  const reading = useRef(new Set<number>());
  const reader = useRef(read);
  useEffect(() => {
    reader.current = read;
  });
  const pending = enabled ? ids.filter((id) => !known.has(id)).join(",") : "";

  useEffect(() => {
    if (!pending) return;
    const queue = pending
      .split(",")
      .map(Number)
      .filter((id) => !reading.current.has(id));
    for (const id of queue) reading.current.add(id);
    const work = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        let entry: DishDescription;
        try {
          const item = await reader.current(id);
          entry = { status: "ready", text: item.description?.trim() || null };
        } catch {
          entry = { status: "error" };
        }
        reading.current.delete(id);
        const done = id;
        setKnown((previous) => new Map(previous).set(done, entry));
      }
    };
    void Promise.all(
      Array.from({ length: Math.min(parallel, queue.length) }, work),
    );
  }, [pending]);

  return {
    describe: (id: number): DishDescription => known.get(id) ?? loading,
    retry: (id: number) =>
      setKnown((previous) => {
        const next = new Map(previous);
        next.delete(id);
        return next;
      }),
  };
}

/** Dish descriptions from DISH-02. */
export function useDishDescriptions(
  service: ExploreService,
  dishIds: readonly number[],
  enabled: boolean,
) {
  return useDescriptions((id) => service.dish(id), dishIds, enabled);
}

/** Restaurant descriptions from REST-02. */
export function useRestaurantDescriptions(
  service: ExploreService,
  restaurantIds: readonly number[],
  enabled: boolean,
) {
  return useDescriptions(
    (id) => service.restaurant(id),
    restaurantIds,
    enabled,
  );
}
