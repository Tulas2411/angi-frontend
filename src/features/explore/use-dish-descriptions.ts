"use client";
import { useEffect, useRef, useState } from "react";
import type { ExploreService } from "./explore-service";

/** A dish card (DISH-01) has no description; it is read from DISH-02 for the dishes on screen. */
export type DishDescription =
  | { status: "loading" }
  | { status: "ready"; text: string | null }
  | { status: "error" };

/** Reads at a time, so a long page does not open dozens of requests at once. */
const parallel = 4;
const loading: DishDescription = { status: "loading" };

/**
 * Descriptions of the listed dishes, loaded once a layout shows them and kept while the page
 * lives: switching layouts or loading more never asks twice for the same dish.
 */
export function useDishDescriptions(
  service: ExploreService,
  dishIds: readonly number[],
  enabled: boolean,
) {
  const [known, setKnown] = useState<ReadonlyMap<number, DishDescription>>(
    () => new Map(),
  );
  const reading = useRef(new Set<number>());
  const pending = enabled
    ? dishIds.filter((id) => !known.has(id)).join(",")
    : "";

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
          const dish = await service.dish(id);
          entry = { status: "ready", text: dish.description?.trim() || null };
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
  }, [service, pending]);

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
