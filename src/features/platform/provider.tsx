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
  notify: (message: string) => void;
  busy: boolean;
  status: "loading" | "ready" | "unavailable";
  reload: () => Promise<void>;
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
  return (
    <Context.Provider
      value={{ data, mode, mutate, notify: setToast, busy, status, reload }}
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
