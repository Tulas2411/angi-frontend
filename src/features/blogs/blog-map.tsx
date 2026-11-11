"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { mapStyles } from "@/shared/maps/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

/** One place of the shared roadmap, with the coordinates read from the restaurant API. */
export interface BlogMapStop {
  id: string;
  label: string;
  dayNumber: number;
  mealSlot: string;
  latitude: number;
  longitude: number;
}

/** Shown when nothing is located yet: the whole country, like the owner location picker. */
const vietnamView = { center: [106.2, 16.3] as [number, number], zoom: 4.6 };

/**
 * The half-page map of a blog: the places of the shared roadmap, pinned on the base map.
 * It never searches places or asks for a route; the pins come from the blog's own data.
 */
export function BlogMap({ stops }: { stops: BlogMapStop[] }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const fit = useRef<() => void>(() => {});
  const draw = useRef<() => void>(() => {});
  const markers = useRef<Marker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  const points = useMemo(
    () =>
      stops.map((stop) => [stop.longitude, stop.latitude] as [number, number]),
    [stops],
  );
  // The pins arrive once the restaurants of the roadmap have been read, so the
  // latest list is kept in a ref and drawn when it changes.
  const latest = useRef({ stops, points });
  useEffect(() => {
    latest.current = { stops, points };
  }, [stops, points]);

  useEffect(() => {
    if (!token || !container.current) return;
    const element = container.current;
    let disposed = false;
    let instance: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    const reducedMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fail = (event?: unknown) => {
      if (disposed) return;
      const code = (event as { error?: { status?: unknown } } | undefined)?.error
        ?.status;
      setErrorStatus(typeof code === "number" ? code : null);
      setStatus("error");
      observer?.disconnect();
      instance?.remove();
      instance = null;
      map.current = null;
    };

    async function initialize() {
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        if (disposed) return;
        const first = latest.current.points[0];
        instance = new mapboxgl.Map({
          container: element,
          accessToken: token,
          style: mapStyles.streets,
          center: first ?? vietnamView.center,
          zoom: latest.current.points.length ? 12 : vietnamView.zoom,
          minZoom: 2,
          maxZoom: 18,
          projection: "mercator",
          attributionControl: true,
          cooperativeGestures: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        map.current = instance;
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();

        fit.current = () => {
          if (!instance || disposed) return;
          if (element.clientWidth === 0 || element.clientHeight === 0) return;
          instance.resize();
          const current = latest.current.points;
          if (!current.length) return;
          if (current.length === 1)
            instance.easeTo({
              center: current[0],
              zoom: 14,
              duration: reducedMotion() ? 0 : 360,
            });
          else {
            const bounds = new mapboxgl.LngLatBounds(current[0], current[0]);
            for (const point of current.slice(1)) bounds.extend(point);
            instance.fitBounds(bounds, {
              padding: { top: 72, right: 64, left: 48, bottom: 64 },
              maxZoom: 15,
              retainPadding: false,
              duration: reducedMotion() ? 0 : 360,
            });
          }
        };

        /** Draws the pins of the current stops, replacing the previous ones. */
        draw.current = () => {
          if (!instance || disposed) return;
          for (const marker of markers.current) marker.remove();
          markers.current = [];
          for (const stop of latest.current.stops) {
            const pin = document.createElement("button");
            pin.type = "button";
            // Mapbox otherwise assigns role="img", overriding native button semantics.
            pin.setAttribute("role", "button");
            pin.className = "blog-map-pin";
            pin.dataset.tone = String((stop.dayNumber - 1) % 5);
            pin.textContent = stop.label;
            pin.setAttribute(
              "aria-label",
              `${stop.label}, ngày ${stop.dayNumber}`,
            );
            const marker = new mapboxgl.Marker({
              element: pin,
              anchor: "bottom",
            })
              .setLngLat([stop.longitude, stop.latitude])
              .addTo(instance);
            markers.current.push(marker);
          }
          fit.current();
        };

        instance.on("load", () => {
          if (!instance || disposed) return;
          draw.current();
          setStatus("ready");
        });
        instance.on("error", fail);
        observer = new ResizeObserver(() => {
          instance?.resize();
          fit.current();
        });
        observer.observe(element);
      } catch {
        fail();
      }
    }
    void initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      for (const marker of markers.current) marker.remove();
      markers.current = [];
      instance?.remove();
      map.current = null;
      fit.current = () => {};
      draw.current = () => {};
    };
  }, [token, attempt]);

  // The pins follow the stops, once the map itself is ready.
  useEffect(() => {
    if (status !== "ready") return;
    draw.current();
  }, [stops, status]);

  const hasMap = Boolean(token);
  const message = !hasMap
    ? "Bản đồ chưa sẵn sàng. Bạn vẫn có thể xem các địa điểm của lộ trình."
    : status === "error"
      ? errorStatus === 401 || errorStatus === 403
        ? `Dịch vụ bản đồ từ chối khóa truy cập (lỗi ${errorStatus}). Bạn vẫn có thể xem các địa điểm của lộ trình.${
            process.env.NODE_ENV === "production"
              ? ""
              : " Kiểm tra NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN trong tài khoản Mapbox rồi chạy lại ứng dụng."
          }`
        : "Chưa tải được bản đồ. Bạn vẫn có thể xem các địa điểm của lộ trình."
      : "Đang tải bản đồ…";

  return (
    <div className="blog-map" data-ready={hasMap && status === "ready"}>
      <div
        ref={container}
        className="blog-map-surface"
        role="region"
        aria-label="Bản đồ các địa điểm của lộ trình"
      />
      {!hasMap || status !== "ready" ? (
        <div className="blog-map-status" role="status">
          <p>{message}</p>
          {hasMap && status === "error" && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setStatus("loading");
                setErrorStatus(null);
                setAttempt((value) => value + 1);
              }}
            >
              Thử lại bản đồ
            </button>
          )}
        </div>
      ) : null}
      {status === "ready" && !stops.length && (
        <p className="blog-map-note" role="status">
          Lộ trình chưa có địa điểm để hiển thị trên bản đồ.
        </p>
      )}
    </div>
  );
}
