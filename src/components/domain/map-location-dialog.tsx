"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, Input } from "@/shared/ui";
import { Dialog, Field, Icon } from "@/components/ui/primitives";
import {
  MapControls,
  MapSelectionOverlay,
} from "@/components/domain/map-overlays";
import {
  filterMapPlaces,
  isMapLocation,
  mapCategories,
  searchMapLocations,
  searchMapPlaces,
} from "@/shared/maps/mapbox";
import type { MapLocation, MapRoute, MapStyle } from "@/shared/maps/mapbox";
import { InteractiveLocationMap } from "./interactive-location-map";
import { MapDirectionsPanel } from "./map-directions-panel";

export function MapLocationDialog({
  location,
  onSelect,
  onClose,
  title = "Chọn địa điểm trên bản đồ",
  mapLabel = "Bản đồ chọn địa điểm",
  saveLabel = "Lưu",
  mode = "pick",
  locations = [],
  poiSearchOnly = false,
  prepareSelection,
}: {
  title?: string;
  mapLabel?: string;
  saveLabel?: string;
  location: MapLocation | null;
  onSelect: (location: MapLocation) => void;
  onClose: () => void;
  mode?: "pick" | "explore";
  locations?: MapLocation[];
  poiSearchOnly?: boolean;
  prepareSelection?: (
    point: MapLocation,
    signal: AbortSignal,
  ) => Promise<MapLocation>;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const hasMap = !!token?.startsWith("pk.");
  const initialLocation = location && isMapLocation(location) ? location : null;
  const [center, setCenter] = useState(
    initialLocation ?? {
      name: "Hà Nội",
      latitude: 21.0285,
      longitude: 105.8542,
    },
  );
  const [selectedName, setSelectedName] = useState(
    initialLocation?.name ?? "Vị trí đã chọn",
  );
  const [metadata, setMetadata] = useState<MapLocation | null>(initialLocation);
  const [latitude, setLatitude] = useState(
    initialLocation?.latitude.toString() ?? "",
  );
  const [longitude, setLongitude] = useState(
    initialLocation?.longitude.toString() ?? "",
  );
  const [zoom, setZoom] = useState(14);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapLocation[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"map" | "poi" | "address">(
    poiSearchOnly ? "poi" : "map",
  );
  const [style, setStyle] = useState<MapStyle>("streets");
  const [directionDestination, setDirectionDestination] =
    useState<MapLocation | null>(null);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [activeRoute, setActiveRoute] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [manualOpen, setManualOpen] = useState(!hasMap);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const manualToggle = useRef<HTMLSpanElement>(null);
  const manualId = useId();
  const searchController = useRef<AbortController | null>(null);
  const saveController = useRef<AbortController | null>(null);
  const placesReader = useRef<(() => MapLocation[]) | null>(null);
  const active = useRef(true);
  const locateRevision = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      locateRevision.current += 1;
      searchController.current?.abort();
      saveController.current?.abort();
    };
  }, []);
  const valid =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180;
  const selected = valid
    ? {
        ...metadata,
        name: selectedName,
        latitude: Number(latitude),
        longitude: Number(longitude),
      }
    : null;
  function select(point: MapLocation, recenter = true) {
    resetSearch();
    if (recenter) setCenter(point);
    setSelectedName(point.name);
    setMetadata(point);
    setLatitude(point.latitude.toFixed(6));
    setLongitude(point.longitude.toFixed(6));
    setSelectionRevision((previous) => previous + 1);
    setError("");
  }
  function updateCoordinate(axis: "latitude" | "longitude", value: string) {
    resetSearch();
    setMetadata(null);
    if (axis === "latitude") setLatitude(value);
    else setLongitude(value);
    const nextLatitude = axis === "latitude" ? value : latitude;
    const nextLongitude = axis === "longitude" ? value : longitude;
    if (
      nextLatitude.trim() &&
      nextLongitude.trim() &&
      Number.isFinite(Number(nextLatitude)) &&
      Number.isFinite(Number(nextLongitude)) &&
      Math.abs(Number(nextLatitude)) <= 90 &&
      Math.abs(Number(nextLongitude)) <= 180
    ) {
      setSelectedName("Vị trí đã chọn");
      setCenter({
        name: "Vị trí đã chọn",
        latitude: Number(nextLatitude),
        longitude: Number(nextLongitude),
      });
      setSelectionRevision((previous) => previous + 1);
      setError("");
    }
  }
  function resetSearch() {
    saveController.current?.abort();
    saveController.current = null;
    setSaving(false);
    locateRevision.current += 1;
    searchController.current?.abort();
    searchController.current = null;
    setBusy(false);
    setResultsOpen(false);
    setError("");
  }
  async function search(category?: string) {
    if (
      (!category && !query.trim()) ||
      !token ||
      busy ||
      saving ||
      searchController.current
    )
      return;
    const activeSearchMode = poiSearchOnly ? "poi" : searchMode;
    if (
      activeSearchMode === "map" ||
      (category && activeSearchMode === "address")
    ) {
      const found = filterMapPlaces(
        [...locations, ...(placesReader.current?.() ?? [])],
        query,
        category,
      );
      setResults(found);
      setResultsOpen(true);
      setError(
        found.length
          ? ""
          : "Không thấy địa điểm trong vùng bản đồ đã tải. Thử di chuyển hoặc phóng to bản đồ rồi tìm lại, chọn POI mở rộng hoặc tìm địa chỉ.",
      );
      return;
    }
    const controller = new AbortController();
    searchController.current = controller;
    setBusy(true);
    setError("");
    setResults([]);
    setResultsOpen(false);
    try {
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(10000),
      ]);
      const found =
        activeSearchMode === "address" && !category
          ? await searchMapLocations(query.trim(), token, signal)
          : await searchMapPlaces(
              query.trim(),
              token,
              center,
              signal,
              category,
            );
      if (
        active.current &&
        searchController.current === controller &&
        !controller.signal.aborted
      ) {
        setResults(found);
        setResultsOpen(true);
        if (!found.length)
          setError(
            poiSearchOnly
              ? "Không tìm thấy nhà hàng phù hợp. Thử tên khác hoặc chấm vị trí trên bản đồ."
              : "Không tìm thấy địa điểm phù hợp. Thử từ khóa khác, tìm địa chỉ hoặc chấm vị trí trên bản đồ.",
          );
      }
    } catch (caught) {
      if (active.current && !controller.signal.aborted)
        setError(
          caught instanceof Error ? caught.message : "Không tìm được địa chỉ.",
        );
    } finally {
      if (active.current && searchController.current === controller) {
        setBusy(false);
        searchController.current = null;
      }
    }
  }
  function locate() {
    if (busy || saving) return;
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ vị trí. Nhập tọa độ địa điểm.");
      return;
    }
    setBusy(true);
    const revision = ++locateRevision.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active.current || revision !== locateRevision.current) return;
        select({
          name: "Vị trí hiện tại",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setManualOpen(false);
        setBusy(false);
      },
      () => {
        if (active.current && revision === locateRevision.current) {
          setError(
            "Không lấy được vị trí. Chấm trên bản đồ hoặc nhập tọa độ địa điểm.",
          );
          setManualOpen(true);
          setBusy(false);
        }
      },
      { timeout: 10000, maximumAge: 0 },
    );
  }
  const ownPlaces = locations.filter(isMapLocation);
  const route = routes[activeRoute];
  const places = [
    ...ownPlaces,
    ...results,
    ...(route
      ? [
          { ...route.origin, name: `Xuất phát: ${route.origin.name}` },
          route.destination,
        ]
      : []),
  ];
  function directions() {
    if (!selected || !hasMap) return;
    resetSearch();
    setManualOpen(false);
    setRoutes([]);
    setActiveRoute(0);
    setDirectionDestination(selected);
  }
  function closeDirections() {
    setDirectionDestination(null);
    setRoutes([]);
    setActiveRoute(0);
  }
  function closeDialog() {
    // Invalidate immediately; passive unmount cleanup may run after a pending response.
    saveController.current?.abort();
    saveController.current = null;
    searchController.current?.abort();
    locateRevision.current += 1;
    onClose();
  }
  async function saveSelection() {
    if (!selected || busy || saveController.current) return;
    const controller = new AbortController();
    saveController.current = controller;
    setSaving(true);
    setError("");
    try {
      const point = prepareSelection
        ? await prepareSelection(selected, controller.signal)
        : selected;
      if (
        !active.current ||
        controller.signal.aborted ||
        saveController.current !== controller
      )
        return;
      onSelect(point);
      closeDialog();
    } catch {
      if (active.current && !controller.signal.aborted)
        setError(
          "Chưa hoàn tất lưu vị trí. Vui lòng thử lại; tọa độ bạn chọn vẫn được giữ nguyên.",
        );
    } finally {
      if (active.current && saveController.current === controller) {
        saveController.current = null;
        setSaving(false);
      }
    }
  }
  return (
    <Dialog open title={title} onClose={closeDialog} map>
      <div
        className={`map-surface mapbox-location-surface${poiSearchOnly ? " map-poi-only-surface" : ""}`}
      >
        {hasMap && !mapFailed ? (
          <InteractiveLocationMap
            token={token ?? ""}
            label={mapLabel}
            camera={{ ...center, zoom }}
            selected={selected}
            selectionRevision={selectionRevision}
            summaryHidden={manualOpen || resultsOpen || !!directionDestination}
            style={style}
            places={places}
            routes={routes}
            activeRoute={activeRoute}
            onDirections={directions}
            onPlacesReader={(reader) => {
              placesReader.current = reader;
            }}
            onCameraChange={(camera) => {
              setCenter((previous) => ({ ...previous, ...camera }));
              setZoom(camera.zoom);
            }}
            onSelect={(point) => {
              resetSearch();
              select(point, false);
              setManualOpen(false);
            }}
            onError={() => {
              setMapFailed(true);
              closeDirections();
              setManualOpen(true);
            }}
          />
        ) : (
          <div className="map-unavailable" aria-hidden>
            <Icon name="LocateFixed" />
          </div>
        )}
        {!directionDestination && (
          <div
            className="map-search"
            role="search"
            aria-label="Tìm vị trí địa điểm"
          >
            <div className="map-search-bar">
              <Input
                type="search"
                aria-label="Tìm địa chỉ hoặc địa điểm"
                placeholder="Tìm địa chỉ hoặc địa điểm"
                value={query}
                maxLength={256}
                disabled={!hasMap}
                autoComplete="off"
                onChange={(event) => {
                  resetSearch();
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
              />
              <Button
                variant="icon"
                aria-label="Tìm kiếm"
                disabled={!hasMap || !query.trim() || busy}
                onClick={() => void search()}
              >
                <Icon name="search" />
              </Button>
            </div>
            {!poiSearchOnly && (
              <>
                <div
                  className="map-choice-row map-search-modes"
                  role="group"
                  aria-label="Loại tìm kiếm"
                >
                  <Button
                    variant="tertiary"
                    aria-pressed={searchMode === "map"}
                    onClick={() => {
                      resetSearch();
                      setSearchMode("map");
                    }}
                  >
                    Vùng bản đồ
                  </Button>
                  <Button
                    variant="tertiary"
                    aria-pressed={searchMode === "poi"}
                    onClick={() => {
                      resetSearch();
                      setSearchMode("poi");
                    }}
                  >
                    POI mở rộng
                  </Button>
                  <Button
                    variant="tertiary"
                    aria-pressed={searchMode === "address"}
                    onClick={() => {
                      resetSearch();
                      setSearchMode("address");
                    }}
                  >
                    Địa chỉ
                  </Button>
                </div>
                <div
                  className="map-category-row"
                  role="group"
                  aria-label="Tìm địa điểm quanh vùng bản đồ"
                >
                  {mapCategories.map((category) => (
                    <Button
                      key={category.id}
                      variant="secondary"
                      disabled={!hasMap || busy}
                      onClick={() => {
                        void search(category.id);
                      }}
                    >
                      {category.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {resultsOpen && !!results.length && (
              <ul className="map-search-results">
                {results.map((point, index) => (
                  <li key={index}>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        select(point);
                        setQuery(point.name);
                        setResultsOpen(false);
                        setManualOpen(false);
                      }}
                    >
                      <span>
                        <strong>{point.name}</strong>
                        <small>{point.fullAddress ?? point.address}</small>
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {!resultsOpen && !!results.length && (
              <Button variant="tertiary" onClick={() => setResultsOpen(true)}>
                Quay lại kết quả ({results.length})
              </Button>
            )}
            {resultsOpen && !!results.length && (
              <Button variant="tertiary" onClick={() => setResultsOpen(false)}>
                Ẩn kết quả
              </Button>
            )}
            {mode === "explore" && !!ownPlaces.length && (
              <details className="map-own-places">
                <summary>Nhà hàng ANGI ({ownPlaces.length})</summary>
                <ul className="map-search-results">
                  {ownPlaces.map((point, index) => (
                    <li key={point.id ?? index}>
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          select(point);
                          setResultsOpen(false);
                        }}
                      >
                        <span>
                          <strong>{point.name}</strong>
                          <small>{point.fullAddress ?? point.address}</small>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        <div
          className={`map-notices${directionDestination ? " map-notices-directions" : ""}`}
        >
          {(!hasMap || mapFailed) && (
            <Alert tone="info">
              {mapFailed
                ? "Không tải được bản đồ. Dùng vị trí hiện tại hoặc nhập tọa độ."
                : "Bạn có thể dùng vị trí hiện tại hoặc nhập tọa độ địa điểm."}
            </Alert>
          )}
          {busy && (
            <p className="map-busy" role="status">
              Đang lấy vị trí…
            </p>
          )}
          {saving && prepareSelection && (
            <p className="map-busy" role="status">
              Đang lấy địa chỉ cho vị trí đã chọn…
            </p>
          )}
          {error && <Alert>{error}</Alert>}
        </div>
        {directionDestination && (
          <MapDirectionsPanel
            token={token ?? ""}
            destination={directionDestination}
            near={center}
            routes={routes}
            activeRoute={activeRoute}
            onRoutes={(next, index) => {
              setRoutes(next);
              setActiveRoute(index);
            }}
            readPlaces={() => [
              ...ownPlaces,
              ...results,
              ...(placesReader.current?.() ?? []),
            ]}
            onClose={closeDirections}
          />
        )}
        <div className="map-style-control" role="group" aria-label="Lớp bản đồ">
          <Button
            variant="secondary"
            disabled={!hasMap || mapFailed}
            aria-pressed={style === "streets"}
            onClick={() => setStyle("streets")}
          >
            Đường phố
          </Button>
          <Button
            variant="secondary"
            disabled={!hasMap || mapFailed}
            aria-pressed={style === "satellite"}
            onClick={() => setStyle("satellite")}
          >
            Vệ tinh
          </Button>
        </div>
        {selected && (!hasMap || mapFailed) && (
          <MapSelectionOverlay
            key={selectionRevision}
            location={selected}
            summaryHidden={manualOpen || !!directionDestination}
          />
        )}
        {!directionDestination && (
          <span ref={manualToggle} className="map-manual-toggle">
            <Button
              variant="secondary"
              aria-expanded={manualOpen}
              aria-controls={manualId}
              onClick={() => setManualOpen((previous) => !previous)}
            >
              Nhập tọa độ
            </Button>
          </span>
        )}
        {manualOpen && (
          <section
            id={manualId}
            className="map-coordinate-panel"
            aria-label="Nhập tọa độ địa điểm"
          >
            <div className="map-coordinate-heading">
              <strong>Nhập tọa độ</strong>
              <Button
                variant="icon"
                aria-label="Đóng bảng nhập tọa độ"
                onClick={() => {
                  setManualOpen(false);
                  manualToggle.current?.querySelector("button")?.focus();
                }}
              >
                <Icon name="X" />
              </Button>
            </div>
            <div className="grid-2">
              <Field
                label="Vĩ độ"
                type="number"
                step="any"
                min={-90}
                max={90}
                value={latitude}
                onChange={(event) =>
                  updateCoordinate("latitude", event.target.value)
                }
              />
              <Field
                label="Kinh độ"
                type="number"
                step="any"
                min={-180}
                max={180}
                value={longitude}
                onChange={(event) =>
                  updateCoordinate("longitude", event.target.value)
                }
              />
            </div>
            <p className="helper">
              Vĩ độ từ −90 đến 90, kinh độ từ −180 đến 180.
            </p>
          </section>
        )}
        <Button
          variant="secondary"
          className="map-save"
          aria-label={mode === "explore" ? "Đóng bản đồ" : saveLabel}
          loading={saving}
          disabled={mode === "pick" && (!selected || busy)}
          onClick={() => {
            if (mode === "explore") {
              closeDialog();
              return;
            }
            void saveSelection();
          }}
        >
          {mode === "explore" ? "Đóng" : saveLabel}
        </Button>
        <MapControls
          onLocate={locate}
          locating={busy || saving}
          onZoomIn={() => setZoom((previous) => Math.min(18, previous + 1))}
          onZoomOut={() => setZoom((previous) => Math.max(3, previous - 1))}
          zoomInDisabled={!hasMap || mapFailed || zoom >= 18}
          zoomOutDisabled={!hasMap || mapFailed || zoom <= 3}
        />
      </div>
    </Dialog>
  );
}
