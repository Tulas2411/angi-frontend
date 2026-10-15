"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { MapLocation } from "@/shared/maps/mapbox";
import { MapSelectionOverlay } from "./map-overlays";
import type { MapPinPosition } from "./map-overlays";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapCamera {
  latitude: number;
  longitude: number;
  zoom: number;
}

/** The camera can move independently of the point that will be saved. */
export function InteractiveLocationMap({
  token,
  label,
  camera,
  selected,
  selectionRevision,
  summaryHidden,
  onCameraChange,
  onSelect,
  onError,
}: {
  token: string;
  label: string;
  camera: MapCamera;
  selected: MapLocation | null;
  selectionRevision: number;
  summaryHidden: boolean;
  onCameraChange: (camera: MapCamera) => void;
  onSelect: (location: MapLocation) => void;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const reproject = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [pinPosition, setPinPosition] = useState<MapPinPosition | null>(null);
  const latest = useRef({
    camera,
    selected,
    onCameraChange,
    onSelect,
    onError,
  });
  useEffect(() => {
    latest.current = { camera, selected, onCameraChange, onSelect, onError };
  }, [camera, selected, onCameraChange, onSelect, onError]);

  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    const surface = element.closest("dialog");
    let disposed = false;
    let instance: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    let styleReady = false;

    function projectSelection() {
      if (!instance || disposed) return;
      const point = latest.current.selected;
      if (!point) {
        setPinPosition(null);
        return;
      }
      // Choose the world copy nearest the viewport when panning across ±180°.
      const longitude =
        point.longitude +
        360 * Math.round((instance.getCenter().lng - point.longitude) / 360);
      const projected = instance.project([longitude, point.latitude]);
      setPinPosition({
        x: projected.x,
        y: projected.y,
        surfaceWidth: element.clientWidth,
        popupWidth: Math.min(
          window.matchMedia("(max-width: 480px)").matches ? 280 : 320,
          element.clientWidth - 32,
        ),
        visible:
          projected.x >= 0 &&
          projected.y >= 0 &&
          projected.x <= element.clientWidth &&
          projected.y <= element.clientHeight,
      });
    }

    // Mapbox handles wheel events on its canvas. Also zoom over the modal's
    // overlay controls, while retaining normal scrolling in editable panels.
    function wheelOverOverlay(event: Event) {
      if (!(event instanceof WheelEvent) || !instance) return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        element.contains(target) ||
        target.closest(
          "input, textarea, select, .combobox-options, .map-search-results, .map-coordinate-panel, .map-location-copy",
        )
      )
        return;
      event.preventDefault();
      if (!event.deltaY) return;
      const bounds = element.getBoundingClientRect();
      const around = instance.unproject([
        Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
        Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
      ]);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      instance.easeTo({
        zoom: Math.max(3, Math.min(18, instance.getZoom() - delta * 0.003)),
        around,
        duration: 150,
      });
    }

    async function initialize() {
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        if (disposed) return;
        const initial = latest.current.camera;
        instance = new mapboxgl.Map({
          container: element,
          accessToken: token,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [initial.longitude, initial.latitude],
          zoom: initial.zoom,
          minZoom: 3,
          maxZoom: 18,
          projection: "mercator",
          dragPan: true,
          scrollZoom: true,
          cooperativeGestures: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          clickTolerance: 5,
        });
        map.current = instance;
        reproject.current = projectSelection;
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();
        instance.on("style.load", () => {
          styleReady = true;
          setReady(true);
        });
        instance.on("error", () => {
          if (!disposed && !styleReady) latest.current.onError();
        });
        instance.on("move", projectSelection);
        instance.on("movestart", () => setMoving(true));
        instance.on("resize", projectSelection);
        instance.on("moveend", () => {
          if (!instance || disposed) return;
          setMoving(false);
          const center = instance.getCenter();
          latest.current.onCameraChange({
            latitude: center.lat,
            longitude: center.lng,
            zoom: instance.getZoom(),
          });
        });
        instance.on("click", (event) => {
          latest.current.onSelect({
            name: "Vị trí đã chọn",
            latitude: event.lngLat.lat,
            longitude: event.lngLat.wrap().lng,
          });
        });
        observer = new ResizeObserver(() => instance?.resize());
        observer.observe(element);
        surface?.addEventListener("wheel", wheelOverOverlay, {
          passive: false,
        });
        projectSelection();
      } catch {
        if (!disposed) latest.current.onError();
      }
    }
    void initialize();
    return () => {
      disposed = true;
      surface?.removeEventListener("wheel", wheelOverOverlay);
      observer?.disconnect();
      instance?.remove();
      map.current = null;
      reproject.current = () => {};
    };
  }, [token]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const center = instance.getCenter();
    if (
      Math.abs(center.lat - camera.latitude) > 1e-8 ||
      Math.abs(center.lng - camera.longitude) > 1e-8 ||
      Math.abs(instance.getZoom() - camera.zoom) > 1e-8
    ) {
      instance.jumpTo({
        center: [camera.longitude, camera.latitude],
        zoom: camera.zoom,
      });
    }
    // Reproject after a new selection, including a click that leaves the camera still.
    reproject.current();
  }, [
    camera.latitude,
    camera.longitude,
    camera.zoom,
    selected?.latitude,
    selected?.longitude,
  ]);

  return (
    <div
      className="map-canvas"
      role="application"
      aria-label={label}
      aria-busy={!ready || moving}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLCanvasElement &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          const center = map.current?.getCenter();
          if (center)
            onSelect({
              name: "Vị trí đã chọn",
              latitude: center.lat,
              longitude: center.wrap().lng,
            });
        }
      }}
    >
      <div ref={container} className="mapbox-interactive-container" />
      {selected && pinPosition && (
        <MapSelectionOverlay
          key={selectionRevision}
          location={selected}
          position={pinPosition}
          summaryHidden={summaryHidden}
        />
      )}
    </div>
  );
}
