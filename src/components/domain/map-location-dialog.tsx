"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Dialog, Field, Icon } from "@/components/ui/primitives";
import {
  MapControls,
  MapSelectionOverlay,
} from "@/components/domain/map-overlays";
import { searchMapLocations } from "@/shared/maps/mapbox";
import type { MapLocation } from "@/shared/maps/mapbox";
import { InteractiveLocationMap } from "./interactive-location-map";
import { ProvinceField } from "./province-field";

export function MapLocationDialog({
  location,
  onSelect,
  onClose,
  title = "Chọn địa điểm trên bản đồ",
  mapLabel = "Bản đồ chọn địa điểm",
  saveLabel = "Lưu",
}: {
  title?: string;
  mapLabel?: string;
  saveLabel?: string;
  location: MapLocation | null;
  onSelect: (location: MapLocation) => void;
  onClose: () => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const hasMap = !!token?.startsWith("pk.");
  const [center, setCenter] = useState(
    location ?? { name: "Hà Nội", latitude: 21.0285, longitude: 105.8542 },
  );
  const [selectedName, setSelectedName] = useState(
    location?.name ?? "Vị trí đã chọn",
  );
  const [latitude, setLatitude] = useState(location?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(
    location?.longitude.toString() ?? "",
  );
  const [zoom, setZoom] = useState(14);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapLocation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [manualOpen, setManualOpen] = useState(!hasMap);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const manualToggle = useRef<HTMLSpanElement>(null);
  const manualId = useId();
  const searchController = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      searchController.current?.abort();
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
        name: selectedName,
        latitude: Number(latitude),
        longitude: Number(longitude),
      }
    : null;
  function select(point: MapLocation, recenter = true) {
    if (recenter) setCenter(point);
    setSelectedName(point.name);
    setLatitude(point.latitude.toFixed(6));
    setLongitude(point.longitude.toFixed(6));
    setSelectionRevision((previous) => previous + 1);
    setError("");
  }
  function updateCoordinate(axis: "latitude" | "longitude", value: string) {
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
  async function search() {
    if (!query.trim() || !token || busy) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setBusy(true);
    setError("");
    try {
      const found = await searchMapLocations(
        query.trim(),
        token,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      );
      if (active.current) {
        setResults(found);
        if (!found.length)
          setError("Không có địa chỉ phù hợp. Thử từ khóa khác.");
      }
    } catch (caught) {
      if (active.current && !controller.signal.aborted)
        setError(
          caught instanceof Error ? caught.message : "Không tìm được địa chỉ.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ vị trí. Nhập tọa độ địa điểm.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active.current) return;
        select({
          name: "Vị trí hiện tại",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setManualOpen(false);
        setBusy(false);
      },
      () => {
        if (active.current) {
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
  return (
    <Dialog open title={title} onClose={onClose} map>
      <div className="map-surface mapbox-location-surface">
        {hasMap && !mapFailed ? (
          <InteractiveLocationMap
            token={token ?? ""}
            label={mapLabel}
            camera={{ ...center, zoom }}
            selected={selected}
            selectionRevision={selectionRevision}
            summaryHidden={manualOpen}
            onCameraChange={(camera) => {
              setCenter((previous) => ({ ...previous, ...camera }));
              setZoom(camera.zoom);
            }}
            onSelect={(point) => select(point, false)}
            onError={() => {
              setMapFailed(true);
              setManualOpen(true);
            }}
          />
        ) : (
          <div className="map-unavailable" aria-hidden>
            <Icon name="LocateFixed" />
          </div>
        )}
        <div
          className="map-search"
          role="search"
          aria-label="Tìm vị trí địa điểm"
        >
          <div className="map-search-bar">
            <ProvinceField
              label="Tìm địa chỉ hoặc địa điểm"
              placeholder="Tìm địa chỉ hoặc địa điểm"
              value={query}
              maxLength={256}
              disabled={!hasMap}
              autoComplete="off"
              showCatalogStatus={false}
              onChange={(value) => {
                setQuery(value);
                setResults([]);
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
          {!!results.length && (
            <ul className="map-search-results">
              {results.map((point, index) => (
                <li key={index}>
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      select(point);
                      setQuery(point.name);
                      setResults([]);
                      setManualOpen(false);
                    }}
                  >
                    {point.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="map-notices">
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
          {error && <Alert>{error}</Alert>}
        </div>
        {selected && (!hasMap || mapFailed) && (
          <MapSelectionOverlay
            key={selectionRevision}
            location={selected}
            summaryHidden={manualOpen}
          />
        )}
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
          aria-label={saveLabel}
          disabled={!selected || busy}
          onClick={() => {
            if (selected) {
              onSelect(selected);
              onClose();
            }
          }}
        >
          Lưu
        </Button>
        <MapControls
          onLocate={locate}
          locating={busy}
          onZoomIn={() => setZoom((previous) => Math.min(18, previous + 1))}
          onZoomOut={() => setZoom((previous) => Math.max(3, previous - 1))}
          zoomInDisabled={!hasMap || mapFailed || zoom >= 18}
          zoomOutDisabled={!hasMap || mapFailed || zoom <= 3}
        />
      </div>
    </Dialog>
  );
}
