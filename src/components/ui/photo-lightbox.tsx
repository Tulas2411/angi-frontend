"use client";
import { useEffect, useRef } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import "./photo-lightbox.css";

export interface LightboxPhoto {
  url: string;
  alt: string;
}

/**
 * One photo shown large over the current page, on a modal `<dialog>` so it sits above any
 * card or map. The X button, Escape and a click outside the photo close it; the arrows and
 * the arrow keys move through the photos.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: readonly LightboxPhoto[];
  /** The photo shown, or null when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null && index < photos.length;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || photos.length < 2) return;
    function move(event: KeyboardEvent) {
      if (index === null) return;
      if (event.key === "ArrowRight")
        onIndexChange((index + 1) % photos.length);
      if (event.key === "ArrowLeft")
        onIndexChange((index - 1 + photos.length) % photos.length);
    }
    document.addEventListener("keydown", move);
    return () => document.removeEventListener("keydown", move);
  }, [open, index, photos.length, onIndexChange]);

  const photo = open ? photos[index] : null;
  const many = photos.length > 1;
  return (
    <dialog
      ref={ref}
      className="photo-lightbox"
      aria-label={photo ? photo.alt : "Xem ảnh"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {photo && index !== null && (
        <>
          <figure
            className="photo-lightbox-figure"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={photo.url} src={photo.url} alt={photo.alt} />
            <figcaption>
              {photo.alt}
              {many && ` · ${index + 1} / ${photos.length}`}
            </figcaption>
          </figure>
          <button
            type="button"
            className="photo-lightbox-close"
            aria-label="Đóng ảnh"
            autoFocus
            onClick={onClose}
          >
            <XMarkIcon aria-hidden />
          </button>
          {many && (
            <>
              <button
                type="button"
                className="photo-lightbox-nav"
                data-side="prev"
                aria-label="Ảnh trước"
                onClick={() =>
                  onIndexChange((index - 1 + photos.length) % photos.length)
                }
              >
                <span className="photo-lightbox-arrow">
                  <ChevronLeftIcon aria-hidden />
                </span>
              </button>
              <button
                type="button"
                className="photo-lightbox-nav"
                data-side="next"
                aria-label="Ảnh tiếp theo"
                onClick={() => onIndexChange((index + 1) % photos.length)}
              >
                <span className="photo-lightbox-arrow">
                  <ChevronRightIcon aria-hidden />
                </span>
              </button>
            </>
          )}
        </>
      )}
    </dialog>
  );
}
