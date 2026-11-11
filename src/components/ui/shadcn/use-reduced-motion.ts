"use client";
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void) {
  const list = window.matchMedia(query);
  list.addEventListener("change", listener);
  return () => list.removeEventListener("change", listener);
}

/** True when the visitor asked the system for less motion; the server assumes motion is fine. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
