"use client";

import { api } from "@/shared/api/client";
import { readWardCatalog, type Province } from "./provinces";

export interface WardCatalogState {
  items: Province[];
  status: "loading" | "ready" | "error";
}
export const initialWardCatalog: WardCatalogState = {
  items: [],
  status: "loading",
};
interface WardStore {
  snapshot: WardCatalogState;
  listeners: Set<() => void>;
  expiresAt: number;
  pending: Promise<Province[]> | null;
}
const stores = new Map<number, WardStore>();

function getStore(code: number): WardStore {
  let store = stores.get(code);
  if (!store) {
    store = {
      snapshot: initialWardCatalog,
      listeners: new Set(),
      expiresAt: 0,
      pending: null,
    };
    stores.set(code, store);
  }
  return store;
}
export function getWardCatalog(code: number | undefined) {
  return code === undefined ? initialWardCatalog : getStore(code).snapshot;
}
export function subscribeWardCatalog(
  code: number | undefined,
  listener: () => void,
) {
  if (code === undefined) return () => {};
  const store = getStore(code);
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}
export function loadWardCatalog(code: number): Promise<Province[]> {
  const store = getStore(code);
  if (store.expiresAt > Date.now())
    return Promise.resolve(store.snapshot.items);
  if (!store.pending) {
    const publish = (snapshot: WardCatalogState) => {
      store.snapshot = snapshot;
      store.listeners.forEach((listener) => listener());
    };
    publish(initialWardCatalog);
    store.pending = api
      .getPublic<unknown>(`locations/provinces/${code}/wards`)
      .then(readWardCatalog)
      .then((items) => {
        store.expiresAt = Date.now() + 5 * 60 * 1000;
        publish({ items, status: "ready" });
        return items;
      })
      .catch((error: unknown) => {
        publish({ items: [], status: "error" });
        throw error;
      })
      .finally(() => {
        store.pending = null;
      });
  }
  return store.pending;
}
