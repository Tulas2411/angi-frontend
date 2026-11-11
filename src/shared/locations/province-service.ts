"use client";

import { api } from "@/shared/api/client";
import { readProvinceCatalog, type Province } from "./provinces";

const cacheLifetime = 5 * 60 * 1000;
export interface ProvinceCatalogState {
  items: Province[];
  status: "loading" | "ready" | "error";
}
export const initialProvinceCatalog: ProvinceCatalogState = {
  items: [],
  status: "loading",
};
let snapshot = initialProvinceCatalog;
const listeners = new Set<() => void>();
let cached: { items: Province[]; expiresAt: number } | null = null;
let pending: Promise<Province[]> | null = null;

export function getProvinceCatalog() {
  return snapshot;
}
export function subscribeProvinceCatalog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(next: ProvinceCatalogState) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** Share public catalog requests across forms and map dialogs, never cache failures. */
export function loadProvinceCatalog(): Promise<Province[]> {
  if (cached && cached.expiresAt > Date.now())
    return Promise.resolve(cached.items);
  if (!pending) {
    publish({ items: [], status: "loading" });
    pending = api
      .getPublic<unknown>("locations/provinces")
      .then(readProvinceCatalog)
      .then((items) => {
        cached = { items, expiresAt: Date.now() + cacheLifetime };
        publish({ items, status: "ready" });
        return items;
      })
      .catch((error: unknown) => {
        publish({ items: [], status: "error" });
        throw error;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
