"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/shared/ui";
import { Icon } from "@/components/ui/primitives";
import "./map-picker.css";

interface MapLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface MapPinPosition {
  x: number;
  y: number;
  visible: boolean;
  surfaceWidth: number;
  popupWidth: number;
}

/** Closing a card only hides that card; the selected point remains. */
export function MapSelectionOverlay({
  location,
  summaryHidden = false,
  position,
}: {
  location: MapLocation;
  summaryHidden?: boolean;
  position?: MapPinPosition;
}) {
  const [pinInfo, setPinInfo] = useState(true);
  const [summary, setSummary] = useState(true);
  const pin = useRef<HTMLButtonElement>(null);
  const popupCenter = position
    ? Math.max(
        position.popupWidth / 2 + 16,
        Math.min(
          position.surfaceWidth - position.popupWidth / 2 - 16,
          position.x,
        ),
      )
    : 0;
  const popupBelow = !!position && position.y < 200;
  const coordinates = `${Math.abs(location.latitude).toFixed(5)}° ${location.latitude < 0 ? "S" : "N"}, ${Math.abs(location.longitude).toFixed(5)}° ${location.longitude < 0 ? "W" : "E"}`;
  return (
    <div className="map-selection-overlay">
      <button
        ref={pin}
        type="button"
        className="map-selected-pin"
        style={position ? { left: position.x, top: position.y } : undefined}
        hidden={position?.visible === false}
        aria-label="Hiển thị thông tin vị trí đã chọn"
        onClick={() => {
          setPinInfo(true);
          setSummary(true);
        }}
      >
        <Image
          src="/assets/figma/SelectedLocationPin.svg"
          width={28}
          height={42}
          alt=""
        />
      </button>
      {(
        [
          [
            "pin",
            pinInfo && position?.visible !== false,
            "Thông tin điểm trên bản đồ",
          ],
          ["summary", summary && !summaryHidden, "Thông tin địa điểm đã chọn"],
        ] as const
      ).map(([kind, visible, label]) =>
        visible ? (
          <section
            key={kind}
            className={`map-location-card map-location-${kind}${kind === "pin" && position ? " map-location-projected" : ""}`}
            style={
              kind === "pin" && position
                ? {
                    left: popupCenter,
                    width: position.popupWidth,
                    top: popupBelow
                      ? Math.max(84, position.y + 16)
                      : position.y - 64,
                    bottom: "auto",
                    transform: popupBelow
                      ? "translateX(-50%)"
                      : "translate(-50%, -100%)",
                  }
                : undefined
            }
            aria-label={label}
          >
            {kind === "pin" && position && (
              <span
                className={`map-popup-arrow${popupBelow ? " map-popup-arrow-above" : ""}`}
                style={{
                  left: Math.max(
                    0,
                    Math.min(
                      position.popupWidth - 14,
                      position.x - popupCenter + position.popupWidth / 2 - 7,
                    ),
                  ),
                }}
                aria-hidden
              />
            )}
            <div className="map-location-copy">
              <strong>{location.name}</strong>
              <p>{coordinates}</p>
            </div>
            <Button
              variant="icon"
              className="map-info-close"
              aria-label={`Ẩn ${label.toLocaleLowerCase("vi")}`}
              onClick={() => {
                if (kind === "pin") setPinInfo(false);
                else setSummary(false);
                pin.current?.focus();
              }}
            >
              <Icon name="X" />
            </Button>
          </section>
        ) : null,
      )}
    </div>
  );
}

export function MapControls({
  onLocate,
  onZoomIn,
  onZoomOut,
  locateLabel = "Dùng vị trí hiện tại",
  locating = false,
  zoomInDisabled,
  zoomOutDisabled,
}: {
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  locateLabel?: string;
  locating?: boolean;
  zoomInDisabled: boolean;
  zoomOutDisabled: boolean;
}) {
  return (
    <div className="map-controls">
      <Button
        variant="icon"
        className="map-locate"
        aria-label={locateLabel}
        title={locateLabel}
        disabled={locating}
        onClick={onLocate}
      >
        <Icon name="LocateFixed" />
      </Button>
      <div className="map-zoom">
        <Button
          variant="icon"
          aria-label="Phóng to bản đồ"
          onClick={onZoomIn}
          disabled={zoomInDisabled}
        >
          <Icon name="Plus" />
        </Button>
        <Button
          variant="icon"
          aria-label="Thu nhỏ bản đồ"
          onClick={onZoomOut}
          disabled={zoomOutDisabled}
        >
          <Icon name="Minus" />
        </Button>
      </div>
    </div>
  );
}
