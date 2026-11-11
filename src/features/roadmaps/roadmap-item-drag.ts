"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { MoveTarget } from "./roadmap-reorder-rules";
import type { MealSlot } from "./roadmap-types";

/** Where the drop line is drawn, relative to the day body that holds it. */
export interface DropIndicator {
  top: number;
  left: number;
  width: number;
}

/** Pointer handlers for the grip of one dish. */
export interface GripProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

export interface DragState {
  itemId: number;
  /** null until the pointer has moved. */
  target: MoveTarget | null;
  indicator: DropIndicator | null;
}

const edgePx = 80;
const scrollStep = 14;

/**
 * Where a dish released at `clientY` would land in the day shown in `container`: the meal band
 * the pointer is in and the position among its other dishes (counted by their midpoints).
 * Reads the DOM (`[data-meal]` bands, `[data-item-id]` rows), so the layout never has to be
 * mirrored in state while the pointer moves.
 */
export function locateDrop(
  container: HTMLElement,
  clientY: number,
  draggedId: number,
): { target: MoveTarget; indicator: DropIndicator } | null {
  const bands = [...container.querySelectorAll<HTMLElement>("[data-meal]")];
  if (!bands.length) return null;
  const band =
    bands.find((entry) => clientY <= entry.getBoundingClientRect().bottom) ??
    bands[bands.length - 1];
  const rows = [...band.querySelectorAll<HTMLElement>("[data-item-id]")].filter(
    (row) => Number(row.dataset.itemId) !== draggedId,
  );
  const index = rows.filter((row) => {
    const box = row.getBoundingClientRect();
    return clientY > box.top + box.height / 2;
  }).length;
  const box = container.getBoundingClientRect();
  const list = (band.querySelector("ol") ?? band).getBoundingClientRect();
  const header = (
    band.querySelector(".roadmap-meal-header") ?? band
  ).getBoundingClientRect();
  const lineY = rows[index]
    ? rows[index].getBoundingClientRect().top - 6
    : rows.length
      ? rows[rows.length - 1].getBoundingClientRect().bottom + 6
      : header.bottom + 6;
  return {
    target: { mealSlot: band.dataset.meal as MealSlot, index },
    indicator: {
      top: lineY - box.top,
      left: list.left - box.left,
      width: list.width,
    },
  };
}

/**
 * Pointer drag of a dish by its grip: works with mouse, pen and touch (the grip has
 * `touch-action: none`). The dragged row follows the pointer, a line shows where it will land,
 * the page scrolls near the top and bottom edge, Escape or a cancelled pointer drops nothing.
 */
export function useItemDrag({
  containerRef,
  disabled,
  onDrop,
}: {
  containerRef: RefObject<HTMLElement | null>;
  disabled: boolean;
  onDrop: (itemId: number, target: MoveTarget) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const session = useRef<{
    itemId: number;
    startPageY: number;
    lastClientY: number;
    edge: -1 | 0 | 1;
    target: MoveTarget | null;
    timer: ReturnType<typeof setInterval>;
  } | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  });

  const rowOf = useCallback(
    (itemId: number) =>
      containerRef.current?.querySelector<HTMLElement>(
        `[data-item-id="${itemId}"] .roadmap-item`,
      ) ?? null,
    [containerRef],
  );

  const follow = useCallback(
    (clientY: number) => {
      const current = session.current;
      const container = containerRef.current;
      if (!current || !container) return;
      current.lastClientY = clientY;
      current.edge =
        clientY < edgePx ? -1 : clientY > window.innerHeight - edgePx ? 1 : 0;
      const row = rowOf(current.itemId);
      if (row)
        row.style.transform = `translateY(${clientY + window.scrollY - current.startPageY}px)`;
      const found = locateDrop(container, clientY, current.itemId);
      current.target = found?.target ?? null;
      setDrag((previous) =>
        previous &&
        previous.target?.mealSlot === found?.target.mealSlot &&
        previous.target?.index === found?.target.index &&
        previous.indicator?.top === found?.indicator.top
          ? previous
          : {
              itemId: current.itemId,
              target: found?.target ?? null,
              indicator: found?.indicator ?? null,
            },
      );
    },
    [containerRef, rowOf],
  );

  const finishRef = useRef<(commit: boolean) => void>(() => undefined);
  // Escape cancels the drag; one listener for the life of the hook.
  const [listener] = useState(() => (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finishRef.current(false);
    }
  });

  const finish = useCallback(
    (commit: boolean) => {
      const current = session.current;
      if (!current) return;
      session.current = null;
      clearInterval(current.timer);
      document.removeEventListener("keydown", listener);
      const row = rowOf(current.itemId);
      if (row) row.style.transform = "";
      setDrag(null);
      if (commit && current.target)
        dropRef.current(current.itemId, current.target);
    },
    [listener, rowOf],
  );
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  useEffect(
    () => () => {
      const current = session.current;
      if (current) clearInterval(current.timer);
      document.removeEventListener("keydown", listener);
    },
    [listener],
  );

  const start = useCallback(
    (itemId: number, event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || session.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const timer = setInterval(() => {
        const current = session.current;
        if (current && current.edge !== 0) {
          window.scrollBy(0, current.edge * scrollStep);
          follow(current.lastClientY);
        }
      }, 16);
      session.current = {
        itemId,
        startPageY: event.clientY + window.scrollY,
        lastClientY: event.clientY,
        edge: 0,
        target: null,
        timer,
      };
      document.addEventListener("keydown", listener);
      setDrag({ itemId, target: null, indicator: null });
    },
    [disabled, follow, listener],
  );

  /** Props for the grip of one dish. */
  const gripProps = useCallback(
    (itemId: number): GripProps => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
        start(itemId, event),
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (session.current?.itemId === itemId) follow(event.clientY);
      },
      onPointerUp: () => {
        if (session.current?.itemId === itemId) finish(true);
      },
      onPointerCancel: () => {
        if (session.current?.itemId === itemId) finish(false);
      },
    }),
    [finish, follow, start],
  );

  return { drag, gripProps };
}
