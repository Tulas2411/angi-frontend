"use client";
import { useEffect, useState } from "react";

/**
 * The photos of a blog, two to a row. Pressing one opens it full size; the arrows and the
 * escape key move through the gallery.
 */
export function BlogPhotos({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight")
        setOpen((value) =>
          value === null ? null : (value + 1) % images.length,
        );
      if (event.key === "ArrowLeft")
        setOpen((value) =>
          value === null ? null : (value - 1 + images.length) % images.length,
        );
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, images.length]);

  if (!images.length) return null;
  const current = open === null ? null : images[open];
  return (
    <section className="blog-section" aria-labelledby="blog-photos-title">
      <header className="blog-section-head">
        <div>
          <p className="blog-eyebrow">Kỷ niệm</p>
          <h2 id="blog-photos-title" className="blog-section-title">
            Hình ảnh lưu giữ kỷ niệm
          </h2>
          <p className="blog-line">
            {images.length} ảnh trong bài. Bấm vào ảnh để xem to.
          </p>
        </div>
      </header>
      <ul className="blog-photos">
        {images.map((url, index) => (
          <li key={url}>
            <button
              type="button"
              className="blog-photo"
              aria-label={`Xem ảnh ${index + 1} của bài ${title} to`}
              onClick={() => setOpen(index)}
              suppressHydrationWarning
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Ảnh ${index + 1} trong bài ${title}`}
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      {current && open !== null && (
        <div
          className="blog-photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh ${open + 1} của bài ${title}`}
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={`Ảnh ${open + 1} trong bài ${title}`}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="blog-photo-close"
            aria-label="Đóng ảnh"
            onClick={() => setOpen(null)}
          >
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="blog-photo-nav blog-photo-prev"
                aria-label="Ảnh trước"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((open - 1 + images.length) % images.length);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="blog-photo-nav blog-photo-next"
                aria-label="Ảnh tiếp theo"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen((open + 1) % images.length);
                }}
              >
                ›
              </button>
              <p className="blog-photo-count">
                {open + 1} / {images.length}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
