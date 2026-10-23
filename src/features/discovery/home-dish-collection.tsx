"use client";
import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { Button } from "@/shared/ui";
import { Dialog } from "@/components/ui/primitives";
import { homeTastes, type HomeDish } from "./home-content";
import type { DishPhoto } from "./home-dish-layout";

interface PhotoStyle extends CSSProperties {
  "--dish-angle": string;
  "--dish-layer": number;
  "--dish-light": number;
  "--dish-size": number;
}

export function HomeDishCollection({
  photos,
}: {
  photos: readonly DishPhoto[];
}) {
  const [selected, setSelected] = useState<HomeDish | null>(null);
  const [previewImage, setPreviewImage] = useState<string>();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const engaged = photos.some(({ dish }) => dish.id === active);
  return (
    <>
      {photos.length ? (
        <div
          className="home-dish-cloud"
          data-count={photos.length}
          data-engaged={engaged}
          role="group"
          aria-label="Bộ ảnh món Việt, chọn ảnh để khám phá"
        >
          {photos.map(({ dish, angle, layer, size }, index) => {
            const style: PhotoStyle = {
              "--dish-angle": `${angle}deg`,
              "--dish-layer": layer,
              "--dish-light": 0.7 + layer * 0.04,
              "--dish-size": size,
            };
            return (
              <article
                key={dish.id}
                className="home-dish-card"
                style={style}
                data-slot={index}
                data-active={active === dish.id}
              >
                <h3 className="sr-only">{dish.name}</h3>
                <Button
                  variant="tertiary"
                  className="home-dish-photo"
                  aria-label={`Khám phá ${dish.name}`}
                  aria-haspopup="dialog"
                  aria-expanded={open && selected?.id === dish.id}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setActive(dish.id);
                  }}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(dish.id)}
                  onBlur={() => setActive(null)}
                  onClick={(event) => {
                    setPreviewImage(
                      event.currentTarget.querySelector("img")?.currentSrc,
                    );
                    setSelected(dish);
                    setOpen(true);
                  }}
                >
                  <Image
                    src={dish.image}
                    alt={dish.imageAlt}
                    fill
                    sizes="(max-width: 700px) 65vw, 360px"
                  />
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="home-empty">
          <h3>Chưa tìm thấy món bạn đang thèm.</h3>
          <p>
            Thử tên món khác, tìm không dấu hoặc bỏ bộ lọc để xem lại bộ sưu
            tập.
          </p>
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="home-food-dialog"
        title={selected?.name ?? "Khám phá món Việt"}
        footer={
          <Button onClick={() => setOpen(false)}>Tiếp tục khám phá</Button>
        }
      >
        {selected && (
          <div className="home-dish-detail">
            <div
              className="home-detail-image"
              style={
                previewImage
                  ? { backgroundImage: `url(${JSON.stringify(previewImage)})` }
                  : undefined
              }
            >
              <Image
                src={selected.image}
                alt={selected.imageAlt}
                fill
                sizes="(max-width: 640px) 90vw, 560px"
              />
            </div>
            <p className="home-origin">
              {selected.origin} ·{" "}
              {
                homeTastes.find((taste) => taste.value === selected.taste)
                  ?.label
              }
            </p>
            <p>{selected.description}</p>
            <div className="home-pairing">
              <strong>Thưởng thức theo cách của bạn</strong>
              <p>{selected.pairing}</p>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
