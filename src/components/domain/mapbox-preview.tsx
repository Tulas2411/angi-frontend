"use client";
import Image from "next/image";
import { useState } from "react";
import { Alert, Button } from "@/shared/ui";
import type { MapLocation } from "@/shared/maps/mapbox";
import { MapControls } from "./map-overlays";
import { useMapViewport } from "./use-map-viewport";

/** Real cartography; the calling workspace still owns its business data. */
export function MapboxPreview({
  locations,
  highlighted,
  showMarkers = true,
}: {
  locations: MapLocation[];
  highlighted?: MapLocation;
  showMarkers?: boolean;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const { ref, size } = useMapViewport();
  const [zoom, setZoom] = useState<number | null>(null);
  const [failedUrl, setFailedUrl] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [overview, setOverview] = useState(false);
  const points = locations.filter(
    (point, index, values) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 85 &&
      Math.abs(point.longitude) <= 180 &&
      values.findIndex(
        (value) =>
          value.latitude === point.latitude &&
          value.longitude === point.longitude,
      ) === index,
  );
  const active = overview ? undefined : highlighted;
  const center = active ??
    points[0] ?? { latitude: 21.0285, longitude: 105.8542 };
  const markers = showMarkers
    ? points
        .map((point) => `pin-s+ff5e62(${point.longitude},${point.latitude})`)
        .join(",")
    : "";
  const viewport =
    !active && zoom === null && points.length > 1 && showMarkers
      ? "auto"
      : `${center.longitude},${center.latitude},${zoom ?? 13}`;
  const url = token?.startsWith("pk.")
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markers ? markers + "/" : ""}${viewport}/${size.width}x${size.height}?access_token=${encodeURIComponent(token)}`
    : "";
  return (
    <div
      ref={ref}
      className="mapbox-preview"
      aria-label="Bản đồ Mapbox các địa điểm trong lịch ăn"
    >
      {url && failedUrl !== url ? (
        <Image
          key={`${url}-${attempt}`}
          src={url}
          unoptimized
          width={size.width}
          height={size.height}
          alt="Bản đồ Mapbox các địa điểm trong lịch ăn"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="mapbox-preview-message">
          <Alert tone="warning">
            {url
              ? "Không tải được bản đồ Mapbox. Vui lòng thử lại."
              : "Chưa có cấu hình Mapbox cho giao diện."}
          </Alert>
          {url && (
            <Button
              variant="secondary"
              onClick={() => {
                setFailedUrl("");
                setAttempt((previous) => previous + 1);
              }}
            >
              Thử lại bản đồ
            </Button>
          )}
        </div>
      )}
      <MapControls
        onLocate={() => {
          setZoom(null);
          setOverview(true);
        }}
        locateLabel="Xem toàn bộ địa điểm"
        onZoomIn={() =>
          setZoom((previous) => Math.min(18, (previous ?? 13) + 1))
        }
        onZoomOut={() =>
          setZoom((previous) => Math.max(3, (previous ?? 13) - 1))
        }
        zoomInDisabled={!url || zoom === 18}
        zoomOutDisabled={!url || zoom === 3}
      />
    </div>
  );
}
