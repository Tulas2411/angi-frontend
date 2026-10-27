"use client";

import { api } from "@/shared/api/client";
import {
  readDistrictCatalog,
  readWardCatalog,
  type Province,
} from "./provinces";

export interface WardCatalogState {
  items: Province[];
  status: "loading" | "ready" | "error";
}
export const initialWardCatalog: WardCatalogState = {
  items: [],
  status: "loading",
};
interface AreaStore {
  snapshot: WardCatalogState;
  listeners: Set<() => void>;
  expiresAt: number;
  pending: Promise<Province[]> | null;
}

/**
 * One store per parent code: the districts of a province, or the wards of a district. Requests
 * for the same parent are shared, results are kept five minutes, failures are never cached.
 */
function areaCatalog(
  path: (code: number) => string,
  read: (payload: unknown) => Province[],
) {
  const stores = new Map<number, AreaStore>();
  const getStore = (code: number): AreaStore => {
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
  };
  return {
    get(code: number | undefined) {
      return code === undefined ? initialWardCatalog : getStore(code).snapshot;
    },
    subscribe(code: number | undefined, listener: () => void) {
      if (code === undefined) return () => {};
      const store = getStore(code);
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    load(code: number): Promise<Province[]> {
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
          .getPublic<unknown>(path(code))
          .then(read)
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
    },
  };
}

const districts = areaCatalog(
  (code) => `locations/provinces/${code}/districts`,
  readDistrictCatalog,
);
const wards = areaCatalog(
  (code) => `locations/districts/${code}/wards`,
  readWardCatalog,
);

/** Districts of a province, by the province's V1 code. */
export const getDistrictCatalog = districts.get;
export const subscribeDistrictCatalog = districts.subscribe;
export const loadDistrictCatalog = districts.load;

/** Wards of a district, by the district's V1 code. */
export const getWardCatalog = wards.get;
export const subscribeWardCatalog = wards.subscribe;
export const loadWardCatalog = wards.load;
