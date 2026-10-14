"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Dialog, Field } from "@/components/ui/primitives";
import {
  locationFromMapPoint,
  searchRestaurantLocations,
} from "./location-service";
import type { RestaurantLocation } from "./restaurant-types";

export function RestaurantLocationPicker({
  location,
  onSelect,
  onClose,
}: {
  location: RestaurantLocation | null;
  onSelect: (location: RestaurantLocation) => void;
  onClose: () => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const hasMap = !!token?.startsWith("pk.");
  const [center, setCenter] = useState(
    location ?? { name: "Hà Nội", latitude: 21.0285, longitude: 105.8542 },
  );
  const [latitude, setLatitude] = useState(location?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(
    location?.longitude.toString() ?? "",
  );
  const [zoom, setZoom] = useState(14);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RestaurantLocation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failedMapUrl, setFailedMapUrl] = useState("");
  const searchController = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      searchController.current?.abort();
    };
  }, []);
  const mapUrl = hasMap
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ff5e62(${center.longitude},${center.latitude})/${center.longitude},${center.latitude},${zoom}/960x480?access_token=${encodeURIComponent(token ?? "")}`
    : "";
  const valid =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180;
  function select(point: RestaurantLocation) {
    setCenter(point);
    setLatitude(point.latitude.toFixed(6));
    setLongitude(point.longitude.toFixed(6));
    setError("");
  }
  async function search() {
    if (!query.trim() || !token || busy) return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setBusy(true);
    setError("");
    try {
      const found = await searchRestaurantLocations(
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
      setError("Trình duyệt không hỗ trợ vị trí. Nhập tọa độ nhà hàng.");
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
        setBusy(false);
      },
      () => {
        if (active.current) {
          setError(
            "Không lấy được vị trí. Chấm trên bản đồ hoặc nhập tọa độ nhà hàng.",
          );
          setBusy(false);
        }
      },
      { timeout: 10000, maximumAge: 0 },
    );
  }
  return (
    <Dialog
      open
      title="Chọn vị trí nhà hàng"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={!valid || busy}
            onClick={() => {
              onSelect({
                name: center.name,
                latitude: Number(latitude),
                longitude: Number(longitude),
              });
              onClose();
            }}
          >
            Lưu vị trí
          </Button>
        </>
      }
    >
      <div className="stack">
        {hasMap ? (
          <>
            <div className="registration-map-search">
              <Field
                label="Tìm địa chỉ hoặc địa điểm"
                value={query}
                maxLength={256}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
              />
              <Button
                variant="secondary"
                disabled={!query.trim() || busy}
                onClick={() => void search()}
              >
                Tìm kiếm
              </Button>
            </div>
            {!!results.length && (
              <ul className="registration-map-results">
                {results.map((point, index) => (
                  <li key={index}>
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        select(point);
                        setResults([]);
                      }}
                    >
                      {point.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {failedMapUrl !== mapUrl && (
              <button
                type="button"
                className="registration-map"
                aria-label="Bản đồ chọn vị trí nhà hàng"
                onClick={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  select(
                    locationFromMapPoint(
                      center,
                      zoom,
                      ((event.clientX - bounds.left) / bounds.width) * 960 -
                        480,
                      ((event.clientY - bounds.top) / bounds.height) * 480 -
                        240,
                    ),
                  );
                }}
                onKeyDown={(event) => {
                  const offsets: Record<string, [number, number]> = {
                    ArrowLeft: [-40, 0],
                    ArrowRight: [40, 0],
                    ArrowUp: [0, -40],
                    ArrowDown: [0, 40],
                  };
                  const offset = offsets[event.key];
                  if (offset) {
                    event.preventDefault();
                    select(locationFromMapPoint(center, zoom, ...offset));
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(center);
                  }
                }}
              >
                <Image
                  src={mapUrl}
                  unoptimized
                  width={960}
                  height={480}
                  alt="Bản đồ nhà hàng, chọn một điểm để cập nhật tọa độ"
                  onError={() => setFailedMapUrl(mapUrl)}
                />
              </button>
            )}
            {failedMapUrl === mapUrl && (
              <Alert tone="warning">
                Không tải được bản đồ. Dùng vị trí hiện tại hoặc nhập tọa độ.
              </Alert>
            )}
            <div className="actions">
              <Button
                variant="secondary"
                disabled={zoom >= 18}
                onClick={() => setZoom(zoom + 1)}
                aria-label="Phóng to bản đồ"
              >
                ＋
              </Button>
              <Button
                variant="secondary"
                disabled={zoom <= 3}
                onClick={() => setZoom(zoom - 1)}
                aria-label="Thu nhỏ bản đồ"
              >
                −
              </Button>
            </div>
            <p className="helper">
              Chấm một điểm trên bản đồ, hoặc dùng các phím mũi tên khi chọn bản
              đồ.
            </p>
          </>
        ) : (
          <Alert tone="info">
            Bạn có thể dùng vị trí hiện tại hoặc nhập tọa độ nhà hàng.
          </Alert>
        )}
        <Button variant="secondary" disabled={busy} onClick={locate}>
          Dùng vị trí hiện tại
        </Button>
        <div className="grid-2">
          <Field
            label="Vĩ độ"
            type="number"
            step="any"
            min={-90}
            max={90}
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
          <Field
            label="Kinh độ"
            type="number"
            step="any"
            min={-180}
            max={180}
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
        </div>
        <p className="helper">
          Vĩ độ từ −90 đến 90, kinh độ từ −180 đến 180. Chỉ lưu sau khi chọn Lưu
          vị trí.
        </p>
        {busy && <p role="status">Đang lấy vị trí…</p>}
        {error && <Alert>{error}</Alert>}
      </div>
    </Dialog>
  );
}
