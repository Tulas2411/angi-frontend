"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Field, Icon } from "@/components/ui/primitives";
import {
  getMapRoutes,
  filterMapPlaces,
  isMapLocation,
  mapDistance,
  searchMapPlaces,
} from "@/shared/maps/mapbox";
import type { MapLocation, MapRoute, RouteProfile } from "@/shared/maps/mapbox";

const profiles: { id: RouteProfile; label: string }[] = [
  { id: "driving", label: "Ô tô" },
  { id: "cycling", label: "Xe đạp" },
  { id: "walking", label: "Đi bộ" },
];

/** Searches and directions are submitted explicitly, never in an effect. */
export function MapDirectionsPanel({
  token,
  destination: initialDestination,
  near,
  routes,
  activeRoute,
  onRoutes,
  onClose,
  readPlaces,
}: {
  token: string;
  destination: MapLocation;
  near: MapLocation;
  routes: MapRoute[];
  activeRoute: number;
  onRoutes: (routes: MapRoute[], active: number) => void;
  onClose: () => void;
  readPlaces: () => MapLocation[];
}) {
  const [origin, setOrigin] = useState<MapLocation | null>(null);
  const [destination, setDestination] = useState<MapLocation | null>(
    initialDestination,
  );
  const [originText, setOriginText] = useState("");
  const [destinationText, setDestinationText] = useState(
    initialDestination.name,
  );
  const [profile, setProfile] = useState<RouteProfile>("driving");
  const [results, setResults] = useState<MapLocation[]>([]);
  const [target, setTarget] = useState<"origin" | "destination">("origin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    alive.current = true;
    panel.current?.focus();
    return () => {
      alive.current = false;
      generation.current += 1;
      controller.current?.abort();
    };
  }, []);

  function invalidate() {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError("");
    setResults([]);
    onRoutes([], 0);
  }
  function choose(point: MapLocation, field: "origin" | "destination") {
    invalidate();
    if (field === "origin") {
      setOrigin(point);
      setOriginText(point.name);
    } else {
      setDestination(point);
      setDestinationText(point.name);
    }
  }
  async function find(field: "origin" | "destination") {
    const query = (field === "origin" ? originText : destinationText).trim();
    if (!query || busy || controller.current) return;
    // Manual coordinates do not consume a provider request.
    const pair = query.split(",").map((part) => part.trim());
    if (
      pair.length === 2 &&
      pair.every((part) => part !== "" && Number.isFinite(Number(part)))
    ) {
      const point = {
        name: query,
        latitude: Number(pair[0]),
        longitude: Number(pair[1]),
      };
      if (isMapLocation(point)) {
        choose(point, field);
        return;
      }
      setError("Tọa độ không hợp lệ. Nhập vĩ độ, kinh độ.");
      return;
    }
    invalidate();
    const local = filterMapPlaces(readPlaces(), query);
    if (local.length) {
      setTarget(field);
      setResults(local);
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setTarget(field);
    setBusy(true);
    try {
      const found = await searchMapPlaces(
        query,
        token,
        near,
        AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
      );
      if (
        alive.current &&
        controller.current === request &&
        !request.signal.aborted
      ) {
        setResults(found);
        if (!found.length)
          setError("Không tìm thấy địa điểm. Bạn có thể nhập vĩ độ, kinh độ.");
      }
    } catch (caught) {
      if (alive.current && !request.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : "Chưa tìm được địa điểm. Hãy nhập tọa độ.",
        );
    } finally {
      if (alive.current && controller.current === request) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  function locate() {
    if (busy) return;
    invalidate();
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ lấy vị trí.");
      return;
    }
    const revision = generation.current;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!alive.current || generation.current !== revision) return;
        choose(
          {
            name: "Vị trí hiện tại",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          "origin",
        );
      },
      () => {
        if (!alive.current || generation.current !== revision) return;
        setBusy(false);
        setError(
          "Không lấy được vị trí. Hãy tìm điểm xuất phát hoặc nhập tọa độ.",
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  async function calculate() {
    if (!origin || !destination || busy || controller.current) return;
    invalidate();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const found = await getMapRoutes(
        origin,
        destination,
        profile,
        token,
        AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      );
      if (
        alive.current &&
        controller.current === request &&
        !request.signal.aborted
      ) {
        onRoutes(found, 0);
        if (!found.length)
          setError(
            "Không có đường đi phù hợp giữa hai điểm với phương tiện này.",
          );
      }
    } catch (caught) {
      if (alive.current && !request.signal.aborted)
        setError(
          caught instanceof Error ? caught.message : "Chưa lấy được chỉ đường.",
        );
    } finally {
      if (alive.current && controller.current === request) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  const route = routes[activeRoute];
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="map-directions-panel"
      aria-label="Chỉ đường"
    >
      <div className="map-coordinate-heading">
        <strong>Chỉ đường</strong>
        <Button variant="icon" aria-label="Đóng chỉ đường" onClick={onClose}>
          <Icon name="X" />
        </Button>
      </div>
      <div className="map-choice-row" role="group" aria-label="Phương tiện">
        {profiles.map((item) => (
          <Button
            key={item.id}
            variant="secondary"
            aria-pressed={profile === item.id}
            onClick={() => {
              invalidate();
              setProfile(item.id);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {(["origin", "destination"] as const).map((field) => (
        <div className="map-endpoint" key={field}>
          <Field
            label={field === "origin" ? "Điểm xuất phát" : "Điểm đến"}
            value={field === "origin" ? originText : destinationText}
            placeholder="Tên địa điểm hoặc vĩ độ, kinh độ"
            maxLength={256}
            autoComplete="off"
            onChange={(event) => {
              invalidate();
              if (field === "origin") {
                setOriginText(event.target.value);
                setOrigin(null);
              } else {
                setDestinationText(event.target.value);
                setDestination(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void find(field);
              }
            }}
          />
          <Button
            variant="icon"
            aria-label={`Tìm ${field === "origin" ? "điểm xuất phát" : "điểm đến"}`}
            disabled={
              busy ||
              !(field === "origin" ? originText : destinationText).trim()
            }
            onClick={() => void find(field)}
          >
            <Icon name="search" />
          </Button>
        </div>
      ))}
      <div className="map-choice-row">
        <Button variant="tertiary" disabled={busy} onClick={locate}>
          Vị trí hiện tại
        </Button>
        <Button
          variant="tertiary"
          disabled={busy || !origin || !destination}
          onClick={() => {
            invalidate();
            setOrigin(destination);
            setDestination(origin);
            setOriginText(destinationText);
            setDestinationText(originText);
          }}
        >
          Đổi hai điểm
        </Button>
      </div>
      {!!results.length && (
        <ul className="map-search-results" aria-label="Địa điểm tìm thấy">
          {results.map((point, index) => (
            <li key={point.id ?? index}>
              <Button variant="tertiary" onClick={() => choose(point, target)}>
                <span>
                  <strong>{point.name}</strong>
                  <small>{point.fullAddress ?? point.address}</small>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        disabled={busy || !origin || !destination}
        onClick={() => void calculate()}
      >
        {busy ? "Đang xử lý…" : "Tìm đường"}
      </Button>
      <p className="helper">
        Chọn kết quả tìm kiếm hoặc nhập tọa độ cho cả hai điểm, rồi bấm Tìm
        đường.
      </p>
      {error && <Alert>{error}</Alert>}
      {!!routes.length && (
        <div
          className="map-route-options"
          role="group"
          aria-label="Các tuyến đường"
        >
          {routes.map((item, index) => (
            <Button
              key={index}
              variant="secondary"
              aria-pressed={index === activeRoute}
              onClick={() => onRoutes(routes, index)}
            >
              <strong>
                {Math.max(1, Math.round(item.duration / 60))} phút ·{" "}
                {mapDistance(item.distance)}
              </strong>
              <small>
                {index === 0 ? "Tuyến đề xuất" : `Tuyến thay thế ${index}`}
                {item.summary ? ` · ${item.summary}` : ""}
              </small>
            </Button>
          ))}
        </div>
      )}
      {route && (
        <>
          <strong>Các bước ({route.steps.length})</strong>
          <ol className="map-route-steps">
            {route.steps.map((step, index) => (
              <li key={index}>
                <span>{step.instruction}</span>
                <small>{mapDistance(step.distance)}</small>
              </li>
            ))}
          </ol>
          <p className="helper">
            Lộ trình tham khảo theo dữ liệu Mapbox; luôn tuân theo biển báo thực
            tế.
          </p>
        </>
      )}
    </section>
  );
}
