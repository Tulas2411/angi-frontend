"use client";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { initialData } from "@/mocks/fixtures";
import type { AppData, DataMode } from "./contracts";
import { createDemoService, liveService } from "@/api/services/data-service";
import { Alert } from "@/shared/ui";
interface PlatformContext {
  data: AppData;
  mode: DataMode;
  mutate: (update: (data: AppData) => void, message?: string) => Promise<void>;
  /**
   * Apply a state change without triggering the toast/busy UX. Use for
   * background sync from the BE (e.g. keeping `data.profile` aligned
   * with the authenticated session) where the user should not see a
   * "Đã lưu" toast.
   */
  setSilent: (update: (data: AppData) => void) => void;
  notify: (message: string) => void;
  busy: boolean;
  status: "loading" | "ready" | "unavailable";
  reload: () => Promise<void>;
  getDemoResource: <T>(key: string, create: () => T) => T;
}
const Context = createContext<PlatformContext | null>(null);
export function PlatformProvider({
  children,
  mode = "demo",
  seed = initialData,
}: {
  children: ReactNode;
  mode?: DataMode;
  seed?: AppData;
}) {
  const [data, setData] = useState(() => structuredClone(seed)),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<PlatformContext["status"]>(
      mode === "demo" ? "ready" : "loading",
    );
  const current = useRef(data),
    demoResources = useRef(new Map<string, unknown>()),
    queue = useRef<Promise<void>>(Promise.resolve()),
    pending = useRef(0);
  const service = useMemo(
    () => (mode === "demo" ? createDemoService() : liveService),
    [mode],
  );
  useEffect(() => {
    if (mode === "demo") return;
    let active = true;
    service
      .load()
      .then((loaded) => {
        if (!active) return;
        current.current = loaded;
        setData(loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, [mode, service]);
  async function reload() {
    setStatus("loading");
    try {
      const loaded = await service.load();
      current.current = loaded;
      setData(loaded);
      setStatus("ready");
    } catch {
      setStatus("unavailable");
    }
  }
  function getDemoResource<T>(key: string, create: () => T): T {
    if (!demoResources.current.has(key))
      demoResources.current.set(key, create());
    return demoResources.current.get(key) as T;
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function mutate(
    update: (data: AppData) => void,
    message = "Đã lưu trong bản minh họa.",
  ) {
    pending.current++;
    setBusy(true);
    const operation = queue.current.then(async () => {
      const next = structuredClone(current.current);
      update(next);
      const saved = await service.save(next);
      current.current = saved;
      setData(saved);
      setToast(message);
    });
    queue.current = operation
      .catch((error) =>
        setToast(
          error instanceof Error ? error.message : "Chưa lưu được thay đổi.",
        ),
      )
      .finally(() => {
        pending.current--;
        setBusy(pending.current > 0);
      });
    return operation;
  }
  /**
   * Apply a state change without the toast/busy UX. Used to push
   * authenticated session data into the platform store so the rest of
   * the app can read it through the existing `data.*` shape.
   *
   * The data service `save` is called when the contract is available
   * (demo service keeps a local copy), but for the live service it
   * throws `UnavailableContractError` because there is no generic
   * write-back endpoint. In that case we just keep the in-memory update
   * and skip the service round-trip — this method is *only* for local
   * state sync, never a real backend write.
   */
  function setSilent(update: (data: AppData) => void) {
    const operation = queue.current.then(async () => {
      const next = structuredClone(current.current);
      update(next);
      let saved = next;
      try {
        saved = await service.save(next);
      } catch (err) {
        // Live service throws UnavailableContractError — that is fine
        // for a session-sync write. Keep the in-memory state we just
        // computed and move on. Any other error also keeps the local
        // state, since this is a background sync, not a real write.
        if (
          !(err instanceof Error) ||
          !err.message.includes("chưa có hợp đồng API")
        ) {
          // eslint-disable-next-line no-console
          console.warn("[platform:setSilent] save failed:", err);
        }
      }
      current.current = saved;
      setData(saved);
    });
    queue.current = operation.catch(() => undefined);
  }
  return (
    <Context.Provider
      value={{
        data,
        mode,
        mutate,
        setSilent,
        notify: setToast,
        busy,
        status,
        reload,
        getDemoResource,
      }}
    >
      {children}
      {toast && (
        <div className="toast">
          <Alert tone="info">
            {toast}
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setToast("")}
            >
              ×
            </button>
          </Alert>
        </div>
      )}
    </Context.Provider>
  );
}
export function usePlatform() {
  const value = useContext(Context);
  if (!value) throw new Error("Thiếu PlatformProvider.");
  return value;
}
