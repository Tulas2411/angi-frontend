"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Media } from "@/components/ui/primitives";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";
import { Button } from "@/shared/ui";
import { dishHref } from "@/features/explore/explore-routes";
import { useRemote } from "@/features/explore/use-remote";
import {
  addItemError,
  buildAddItemRequest,
  mealSlots,
  suggestionsError,
} from "./roadmap-add-item-rules";
import { mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import type { RoadmapItemService } from "./roadmap-service";
import type { DishCardDto, MealSlot, RoadmapDayDto } from "./roadmap-types";
import { FadingText } from "@/components/ui/fading-text";
import "./roadmap-place.css";

/** RM-06 allows 1..50; one short strip per day. */
const stripSize = 10;

/**
 * Wanderlog-style "Địa điểm được đề xuất" under a day: RM-06 for the day's province. "+" opens a
 * small menu of the day's meals and adds the dish (RM-07) to the one picked. Loaded once per day and
 * province; an added dish leaves the strip at once and RM-03 is read again by the parent.
 */
export function SuggestedPlaces({
  roadmapId,
  day,
  province,
  gps,
  service,
  onAdded,
}: {
  roadmapId: number;
  day: RoadmapDayDto;
  /** Empty while the roadmap's destination is unknown: the strip then says how to set one. */
  province: string;
  gps?: { latitude: number; longitude: number };
  service: Pick<RoadmapItemService, "suggestions" | "addItem">;
  /** RM-07 succeeded: the parent reloads the roadmap. */
  onAdded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [added, setAdded] = useState<readonly number[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  // The dish whose "+" menu of meals is open.
  const [picking, setPicking] = useState<number | null>(null);
  const [problem, setProblem] = useState("");
  const track = useRef<HTMLUListElement>(null);
  const bodyId = `suggested-${day.dayId}`;
  const [state, retry] = useRemote(
    () =>
      province
        ? service.suggestions(roadmapId, {
            province,
            dayId: day.dayId,
            limit: stripSize,
            ...(gps ? { lat: gps.latitude, lng: gps.longitude } : {}),
          })
        : Promise.resolve(null),
    `${day.dayId}:${province}:${gps ? `${gps.latitude},${gps.longitude}` : "-"}`,
  );

  /** How many dishes each meal of the day already has, shown in the menu. */
  const dishesIn = (slot: MealSlot) =>
    day.items.filter((item) => item.mealSlot === slot).length;

  async function add(dish: DishCardDto, requestId: string, slot: MealSlot) {
    if (adding !== null) return;
    setPicking(null);
    setAdding(dish.id);
    setProblem("");
    try {
      await service.addItem(
        roadmapId,
        day.dayId,
        buildAddItemRequest(dish, slot, requestId),
      );
    } catch (caught) {
      const failure = addItemError(caught);
      if (failure.unavailable) setAdded((previous) => [...previous, dish.id]);
      setProblem(failure.message);
      setAdding(null);
      return;
    }
    setAdded((previous) => [...previous, dish.id]);
    try {
      await onAdded();
    } catch {
      setProblem(
        `Đã thêm ${dish.name} nhưng chưa tải lại được lộ trình. Hãy tải lại trang để xem món mới.`,
      );
    } finally {
      setAdding(null);
    }
  }

  // Which arrows make sense: "‹" once the strip has moved, "›" while cards are still hidden.
  const [edges, setEdges] = useState({ prev: false, next: false });
  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const prev = element.scrollLeft > 4;
    const next =
      element.scrollLeft + element.clientWidth < element.scrollWidth - 4;
    setEdges((current) =>
      current.prev === prev && current.next === next ? current : { prev, next },
    );
  }, []);
  const shown =
    state.status === "ready"
      ? (state.data?.items ?? []).filter((dish) => !added.includes(dish.id))
          .length
      : 0;
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, shown, open]);

  const scroll = (direction: 1 | -1) =>
    track.current?.scrollBy({
      left: direction * track.current.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });

  let content;
  if (!province)
    content = (
      <p className="helper">
        Bấm “Thêm món” và chọn tỉnh / thành phố để ANGI gợi ý địa điểm cho ngày
        này.
      </p>
    );
  else if (state.status === "loading")
    content = (
      <ul className="roadmap-suggested-track" aria-hidden>
        {[0, 1, 2].map((index) => (
          <li key={index} className="roadmap-suggested-card is-loading" />
        ))}
      </ul>
    );
  else if (state.status === "error")
    content = (
      <div className="roadmap-place-failed" role="alert">
        <p>{suggestionsError(state.error).message}</p>
        <Button variant="secondary" onClick={retry}>
          Thử lại
        </Button>
      </div>
    );
  else {
    const answer = state.data;
    const dishes = (answer?.items ?? []).filter(
      (dish) => !added.includes(dish.id),
    );
    content = dishes.length ? (
      <div
        className="roadmap-suggested-scroller"
        data-prev={edges.prev}
        data-next={edges.next}
      >
        <button
          type="button"
          className="roadmap-suggested-arrow is-prev"
          aria-label="Xem các gợi ý trước"
          disabled={!edges.prev}
          onClick={() => scroll(-1)}
        >
          ‹
        </button>
        <ul
          ref={track}
          onScroll={measure}
          className="roadmap-suggested-track"
          aria-label={`Địa điểm gợi ý tại ${province}`}
        >
          {dishes.map((dish) => (
            <li key={dish.id} className="roadmap-suggested-card">
              <Link
                href={dishHref(dish.id)}
                prefetch={false}
                target="_blank"
                rel="noreferrer"
                className="roadmap-suggested-body"
              >
                <Media src={dish.coverUrl ?? undefined} alt="" />
                <span>
                  <strong>{dish.name}</strong>
                  <FadingText
                    as="small"
                    text={`${dish.restaurant.name} · ${vnd(dish.price)}`}
                  />
                </span>
              </Link>
              <Popover
                open={picking === dish.id}
                onOpenChange={(next) => setPicking(next ? dish.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="roadmap-suggested-add"
                    aria-label={`Thêm ${dish.name} vào ngày ${day.dayNumber}`}
                    title="Thêm vào một bữa"
                    aria-busy={adding === dish.id || undefined}
                    disabled={adding !== null}
                  >
                    {adding === dish.id ? (
                      <span className="spinner" aria-hidden />
                    ) : (
                      <PlusIcon aria-hidden />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="roadmap-meal-picker"
                  align="end"
                  aria-label={`Chọn bữa cho ${dish.name}`}
                >
                  <p className="roadmap-meal-picker-title">Thêm vào bữa nào?</p>
                  <ul>
                    {mealSlots.map((slot) => (
                      <li key={slot}>
                        <button
                          type="button"
                          aria-label={`Thêm ${dish.name} vào ${mealSlotLabels[slot].toLowerCase()} ngày ${day.dayNumber}`}
                          onClick={() =>
                            answer && void add(dish, answer.requestId, slot)
                          }
                        >
                          <span>{mealSlotLabels[slot]}</span>
                          <small>
                            {dishesIn(slot)
                              ? `${dishesIn(slot)} món`
                              : "Chưa có món"}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="roadmap-suggested-arrow is-next"
          aria-label="Xem thêm gợi ý"
          disabled={!edges.next}
          onClick={() => scroll(1)}
        >
          ›
        </button>
      </div>
    ) : (
      <p className="helper">
        Chưa có gợi ý mới tại {province}. Bấm “Thêm món” để tìm theo bộ lọc
        khác.
      </p>
    );
  }

  return (
    <section className="roadmap-suggested" aria-labelledby={`${bodyId}-title`}>
      <h4 id={`${bodyId}-title`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="roadmap-suggested-chevron" aria-hidden>
            ›
          </span>
          Địa điểm được đề xuất
        </button>
      </h4>
      {/* Folds with a height and fade transition; `inert` keeps the folded cards out of reach. */}
      <div
        id={bodyId}
        className="roadmap-suggested-fold"
        data-open={open}
        inert={!open}
      >
        <div>
          {content}
          {problem && (
            <p className="roadmap-suggested-problem" role="alert">
              {problem}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
