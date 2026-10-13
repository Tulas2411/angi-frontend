"use client";
import { useState } from "react";
import { Button } from "@/shared/ui";
import { Dialog, Field, Icon } from "@/components/ui/primitives";
import { mapBlocks, mapLayers } from "./map-artwork";
const locations = [
  { name: "Hồ Hoàn Kiếm", latitude: 21.0285, longitude: 105.8542 },
  { name: "Phố cổ Hà Nội", latitude: 21.0345, longitude: 105.8532 },
  { name: "Nhà thờ Lớn Hà Nội", latitude: 21.0288, longitude: 105.8496 },
];
export function MapPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (location: (typeof locations)[number]) => void;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(locations[0]),
    [zoom, setZoom] = useState(1);
  return (
    <Dialog open={open} onClose={onClose} title="Chọn địa điểm trên bản đồ" map>
      <div className="map-surface">
        <div
          className="map-art"
          style={{ transform: `translate(-50%, -50%) scale(${zoom})` }}
          aria-hidden
        >
          {mapBlocks.map((b, i) => (
            <div
              className="map-block"
              key={i}
              style={{
                left: b.x,
                top: b.y,
                width: b.width,
                height: b.height,
                background: b.street ? "#faf7ef" : undefined,
              }}
            />
          ))}
          {mapLayers.map((layer) => (
            <img
              className="map-layer"
              key={layer.name}
              src={`/assets/figma/${layer.file}`}
              alt=""
              style={{ left: layer.x, top: layer.y }}
            />
          ))}
          <span
            style={{ position: "absolute", left: 380, top: 530, fontSize: 20 }}
          >
            Hồ Hoàn Kiếm
          </span>
        </div>
        <div className="map-search">
          <Field
            label="Tìm địa chỉ hoặc địa điểm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <div className="stack-sm" style={{ padding: 12 }}>
              {locations
                .filter((l) =>
                  l.name
                    .toLocaleLowerCase("vi")
                    .includes(query.toLocaleLowerCase("vi")),
                )
                .map((l) => (
                  <Button
                    variant="tertiary"
                    key={l.name}
                    onClick={() => {
                      setSelected(l);
                      setQuery("");
                    }}
                  >
                    {l.name}
                  </Button>
                ))}
            </div>
          )}
        </div>
        <div className="map-location">
          <strong>{selected.name}</strong>
          <p className="helper">
            {selected.latitude.toFixed(4)}° N, {selected.longitude.toFixed(4)}°
            E
          </p>
        </div>
        <Button
          className="map-save"
          onClick={() => {
            onSelect(selected);
            onClose();
          }}
        >
          Lưu
        </Button>
        <div className="map-controls">
          <Button
            variant="icon"
            aria-label="Phóng to bản đồ"
            disabled={zoom >= 1.8}
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))}
          >
            <Icon name="Plus" />
          </Button>
          <Button
            variant="icon"
            aria-label="Thu nhỏ bản đồ"
            disabled={zoom <= 0.6}
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
          >
            <Icon name="Minus" />
          </Button>
          <Button
            variant="icon"
            aria-label="Về địa điểm ban đầu"
            onClick={() => {
              setZoom(1);
              setSelected(locations[0]);
            }}
          >
            <Icon name="LocateFixed" />
          </Button>
        </div>
        <span className="map-attribution">ANGI · Bản đồ minh họa</span>
      </div>
    </Dialog>
  );
}
