"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { mapLocationKey, mapStyles } from "@/shared/maps/mapbox";
import type { MapLocation, MapRoute, MapStyle } from "@/shared/maps/mapbox";
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
  style = "streets",
  places = [],
  routes = [],
  activeRoute = 0,
  onDirections,
  onPlacesReader,
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
  style?: MapStyle;
  places?: MapLocation[];
  routes?: MapRoute[];
  activeRoute?: number;
  onDirections?: () => void;
  onPlacesReader?: (reader: (() => MapLocation[]) | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const reproject = useRef<() => void>(() => {});
  const syncData = useRef<() => void>(() => {});
  const appliedStyle = useRef(style);
  const styleLoaded = useRef(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [pinPosition, setPinPosition] = useState<MapPinPosition | null>(null);
  const latest = useRef({
    camera,
    selected,
    onCameraChange,
    onSelect,
    onError,
    places,
    routes,
    activeRoute,
    style,
    onPlacesReader,
  });
  useEffect(() => {
    latest.current = {
      camera,
      selected,
      onCameraChange,
      onSelect,
      onError,
      places,
      routes,
      activeRoute,
      style,
      onPlacesReader,
    };
  }, [
    camera,
    selected,
    onCameraChange,
    onSelect,
    onError,
    places,
    routes,
    activeRoute,
    style,
    onPlacesReader,
  ]);

  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    const surface = element.closest("dialog");
    let disposed = false;
    let instance: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;

    function readVisiblePlaces(): MapLocation[] {
      if (!instance || disposed || !styleLoaded.current) return [];
      const source = instance.getSource("composite");
      if (!source) return [];
      // Streets v12 and Satellite Streets v12 both use the Streets poi_label source layer.
      return instance
        .querySourceFeatures("composite", { sourceLayer: "poi_label" })
        .flatMap((feature) => {
          const name: unknown =
            feature.properties?.name_vi ?? feature.properties?.name;
          if (
            feature.geometry.type !== "Point" ||
            typeof name !== "string" ||
            !name.trim()
          )
            return [];
          const [longitude, latitude] = feature.geometry.coordinates;
          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            !instance?.getBounds()?.contains([longitude, latitude])
          )
            return [];
          return [
            {
              name,
              latitude,
              longitude,
              source: "mapbox" as const,
              featureType: "poi",
              categories: [
                feature.properties?.class,
                feature.properties?.type,
                feature.properties?.maki,
              ].filter((value): value is string => typeof value === "string"),
            },
          ];
        });
    }

    function updateData() {
      if (!instance || disposed || !styleLoaded.current) return;
      const routeData = {
        type: "FeatureCollection" as const,
        features: latest.current.routes
          .map((route, index) => ({
            type: "Feature" as const,
            properties: { active: index === latest.current.activeRoute },
            geometry: {
              type: "LineString" as const,
              coordinates: route.coordinates,
            },
          }))
          .sort(
            (left, right) =>
              Number(left.properties.active) - Number(right.properties.active),
          ),
      };
      const existingRoutes = instance.getSource<GeoJSONSource>("angi-routes");
      if (existingRoutes) existingRoutes.setData(routeData);
      else
        instance.addSource("angi-routes", { type: "geojson", data: routeData });
      if (!instance.getLayer("angi-route-lines"))
        instance.addLayer({
          id: "angi-route-lines",
          type: "line",
          source: "angi-routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["case", ["get", "active"], "#2879ff", "#a9b8d0"],
            "line-width": ["case", ["get", "active"], 6, 4],
          },
        });
      const placeData = {
        type: "FeatureCollection" as const,
        features: latest.current.places.map((point) => ({
          type: "Feature" as const,
          properties: {
            key: mapLocationKey(point),
            name: point.name,
            angi: point.source === "angi",
          },
          geometry: {
            type: "Point" as const,
            coordinates: [point.longitude, point.latitude],
          },
        })),
      };
      const existingPlaces = instance.getSource<GeoJSONSource>("angi-places");
      if (existingPlaces) existingPlaces.setData(placeData);
      else
        instance.addSource("angi-places", { type: "geojson", data: placeData });
      if (!instance.getLayer("angi-place-points"))
        instance.addLayer({
          id: "angi-place-points",
          type: "circle",
          source: "angi-places",
          paint: {
            "circle-radius": 7,
            "circle-color": ["case", ["get", "angi"], "#222222", "#ff5e62"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      if (!instance.getLayer("angi-place-names"))
        instance.addLayer({
          id: "angi-place-names",
          type: "symbol",
          source: "angi-places",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-anchor": "top",
            "text-offset": [0, 1],
            "text-max-width": 16,
          },
          paint: {
            "text-color": "#222222",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        });
    }

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
          "input, textarea, select, .combobox-options, .map-search-results, .map-coordinate-panel, .map-location-copy, .map-directions-panel, .map-category-row, .map-own-places",
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
          style: mapStyles[latest.current.style],
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
        appliedStyle.current = latest.current.style;
        reproject.current = projectSelection;
        syncData.current = updateData;
        latest.current.onPlacesReader?.(readVisiblePlaces);
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();
        instance.on("style.load", () => {
          styleLoaded.current = true;
          setReady(true);
          updateData();
          setStyleRevision((previous) => previous + 1);
        });
        instance.on("error", (event) => {
          const error: unknown = event.error;
          const status =
            error && typeof error === "object" && "status" in error
              ? error.status
              : undefined;
          if (
            !disposed &&
            (!styleLoaded.current || status === 401 || status === 403)
          )
            latest.current.onError();
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
          const layers = ["angi-place-points", "angi-place-names"].filter(
            (id) => instance?.getLayer(id),
          );
          const feature = layers.length
            ? instance?.queryRenderedFeatures(event.point, { layers })[0]
            : undefined;
          const key: unknown = feature?.properties?.key;
          const place =
            typeof key === "string"
              ? latest.current.places.find(
                  (point) => mapLocationKey(point) === key,
                )
              : undefined;
          if (place) {
            latest.current.onSelect(place);
            return;
          }
          // Clicking an existing basemap POI uses rendered vector data, without a search/retrieve request.
          const poiLayers = ["poi-label"].filter((id) =>
            instance?.getLayer(id),
          );
          const poi = poiLayers.length
            ? instance?.queryRenderedFeatures(event.point, {
                layers: poiLayers,
              })[0]
            : undefined;
          const name: unknown =
            poi?.properties?.name_vi ?? poi?.properties?.name;
          if (typeof name === "string" && poi?.geometry.type === "Point") {
            const [longitude, latitude] = poi.geometry.coordinates;
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
              latest.current.onSelect({
                name,
                latitude,
                longitude,
                source: "mapbox",
                featureType: "poi",
              });
              return;
            }
          }
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
      styleLoaded.current = false;
      reproject.current = () => {};
      syncData.current = () => {};
      latest.current.onPlacesReader?.(null);
    };
  }, [token]);

  useEffect(() => {
    const instance = map.current;
    if (instance && appliedStyle.current !== style) {
      appliedStyle.current = style;
      styleLoaded.current = false;
      setReady(false);
      instance.setStyle(mapStyles[style]);
    }
  }, [style]);

  useEffect(() => {
    syncData.current();
  }, [places, routes, activeRoute, styleRevision]);

  useEffect(() => {
    const instance = map.current;
    const coordinates = routes[activeRoute]?.coordinates;
    if (!instance || !coordinates?.length) return;
    const bounds: [[number, number], [number, number]] = coordinates.reduce<
      [[number, number], [number, number]]
    >(
      (range, point) => [
        [Math.min(range[0][0], point[0]), Math.min(range[0][1], point[1])],
        [Math.max(range[1][0], point[0]), Math.max(range[1][1], point[1])],
      ],
      [
        [coordinates[0][0], coordinates[0][1]],
        [coordinates[0][0], coordinates[0][1]],
      ],
    );
    const wide = instance.getContainer().clientWidth >= 760;
    instance.fitBounds(bounds, {
      padding: {
        left: wide ? 380 : 40,
        right: 60,
        top: wide ? 60 : 160,
        bottom: 100,
      },
      maxZoom: 16,
      duration: 500,
    });
  }, [routes, activeRoute]);

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
          onDirections={onDirections}
        />
      )}
    </div>
  );
}
