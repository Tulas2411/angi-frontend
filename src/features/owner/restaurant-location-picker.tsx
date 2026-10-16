"use client";
import { MapLocationDialog } from "@/components/domain/map-location-dialog";
import type { RestaurantLocation } from "./restaurant-types";

export function RestaurantLocationPicker(props: {
  location: RestaurantLocation | null;
  onSelect: (location: RestaurantLocation) => void;
  onClose: () => void;
}) {
  return (
    <MapLocationDialog
      {...props}
      poiSearchOnly
      title="Chọn vị trí nhà hàng"
      mapLabel="Bản đồ chọn vị trí nhà hàng"
      saveLabel="Lưu vị trí"
    />
  );
}
