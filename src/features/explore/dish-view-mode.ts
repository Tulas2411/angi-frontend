"use client";
import { useSyncExternalStore } from "react";

/** The three layouts of the dish list; every one shows the same filtered dishes. */
export type DishView = "list" | "detailed" | "gallery";

export const dishViews: { value: DishView; label: string }[] = [
  { value: "list", label: "Danh sách" },
  { value: "detailed", label: "Lưới chi tiết" },
  { value: "gallery", label: "Thư viện ảnh" },
];

export const defaultDishView: DishView = "detailed";
const storageKey = "angi:dish-view";
const changed = "angi:dish-view-changed";
/** This tab's choice, used when the browser refuses storage (private mode, blocked site data). */
let chosen: DishView | null = null;

function isDishView(value: unknown): value is DishView {
  return value === "list" || value === "detailed" || value === "gallery";
}

function readView(): DishView {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isDishView(stored)) return stored;
  } catch {
    // Storage blocked: fall back to this tab's choice.
  }
  return chosen ?? defaultDishView;
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changed, listener);
  };
}

function storeView(next: DishView) {
  chosen = next;
  try {
    window.localStorage.setItem(storageKey, next);
  } catch {
    // Not remembered across visits; the choice still applies in this tab.
  }
  window.dispatchEvent(new Event(changed));
}

/** The remembered layout; the server render and the first paint use the default. */
export function useDishView(): [DishView, (view: DishView) => void] {
  const view = useSyncExternalStore(subscribe, readView, () => defaultDishView);
  return [view, storeView];
}
