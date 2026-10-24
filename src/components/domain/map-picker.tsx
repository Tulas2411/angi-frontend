"use client";
import { MapLocationDialog } from "./legacy-map/map-location-dialog";
import type { MapLocation } from "@/shared/maps/legacy-mapbox";

const initialCenter: MapLocation = {
  name: "Hồ Hoàn Kiếm",
  latitude: 21.0285,
  longitude: 105.8542,
};

/** Every location picker uses real Mapbox geography, including demo workspaces. */
export function MapPicker({
  open,
  onClose,
  onSelect,
  initialLocation,
  poiSearchOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (location: MapLocation) => void;
  initialLocation?: MapLocation;
  poiSearchOnly?: boolean;
}) {
  return open ? (
    <MapLocationDialog
      location={initialLocation ?? initialCenter}
      poiSearchOnly={poiSearchOnly}
      onClose={onClose}
      onSelect={onSelect}
    />
  ) : null;
}
