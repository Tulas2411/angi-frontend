"use client";
import { MapLocationDialog } from "@/components/domain/map-location-dialog";
// The same address lookup as the restaurant registration: one reverse lookup per explicit save.
import { resolveRestaurantAddress } from "@/features/owner/location-service";
import type { RoadmapOrigin } from "./roadmap-types";

/** Same map dialog as the restaurant registration form; the saved point also carries its province. */
export function RoadmapOriginPicker(props: {
  location: RoadmapOrigin | null;
  onSelect: (location: RoadmapOrigin) => void;
  onClose: () => void;
}) {
  return (
    <MapLocationDialog
      {...props}
      prepareSelection={(point, signal) =>
        resolveRestaurantAddress(
          point,
          process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
          signal,
        )
      }
      title="Chọn điểm xuất phát"
      mapLabel="Bản đồ chọn điểm xuất phát"
      saveLabel="Lưu điểm xuất phát"
    />
  );
}
