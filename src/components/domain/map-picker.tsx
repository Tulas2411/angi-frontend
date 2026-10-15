"use client";
import { MapLocationDialog } from "./map-location-dialog";
import type { MapLocation } from "@/shared/maps/mapbox";

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
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (location: MapLocation) => void;
  initialLocation?: MapLocation;
}) {
  return open ? (
    <MapLocationDialog
      location={initialLocation ?? initialCenter}
      onClose={onClose}
      onSelect={onSelect}
    />
  ) : null;
}
