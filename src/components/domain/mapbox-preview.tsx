"use client";

import { useState } from "react";
import { Button } from "@/shared/ui";
import { isMapLocation } from "@/shared/maps/legacy-mapbox";
import type { MapLocation } from "@/shared/maps/legacy-mapbox";
import { MapLocationDialog } from "./legacy-map/map-location-dialog";
import "./legacy-map/map-picker.css";

/** ANGI coordinates are rendered directly; opening the page never loads a map. */
export function RestaurantMapButton({
  locations,
  highlighted,
  showMarkers = true,
}: {
  locations: MapLocation[];
  highlighted?: MapLocation;
  showMarkers?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const points = locations
    .filter(isMapLocation)
    .map((point) => ({ ...point, source: "angi" as const }));
  const selected =
    highlighted && isMapLocation(highlighted)
      ? { ...highlighted, source: "angi" as const }
      : (points[0] ?? null);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Mở bản đồ tương tác{points.length ? ` (${points.length} quán)` : ""}
      </Button>
      {open && (
        <MapLocationDialog
          mode="explore"
          title="Bản đồ khám phá địa điểm"
          mapLabel="Bản đồ nhà hàng ANGI"
          location={selected}
          locations={showMarkers ? points : []}
          onSelect={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function MapboxPreview(props: {
  locations: MapLocation[];
  highlighted?: MapLocation;
  showMarkers?: boolean;
}) {
  return (
    <div
      className="mapbox-preview mapbox-preview-lazy"
      aria-label="Bản đồ các địa điểm trong lịch ăn"
    >
      <div className="mapbox-preview-message">
        <strong>Khám phá quán trên bản đồ</strong>
        <p>Xem vị trí, tìm địa điểm và chỉ đường khi bạn mở bản đồ.</p>
        <RestaurantMapButton {...props} />
      </div>
    </div>
  );
}
