"use client";
import "./restaurant-image-upload.css";
import { useId } from "react";
import { Button } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { useRestaurantImageUpload } from "./restaurant-image-upload";
import type { RestaurantRegistrationService } from "./restaurant-service";

export type GalleryPhoto = { id: number; url: string };

export const GALLERY_LIMIT = 10;

/**
 * Ordered gallery edited photo by photo: add, drop and move. OWN-03 receives the
 * final `imageMediaIds`; saved photos keep the ids returned by OWN-02.
 */
export function RestaurantGalleryField({
  photos,
  changed,
  disabled,
  error,
  service,
  onChange,
  onPending,
  onRestore,
  onClear,
}: {
  photos: GalleryPhoto[];
  changed: boolean;
  disabled: boolean;
  error?: string;
  service: Pick<RestaurantRegistrationService, "upload">;
  onChange: (photos: GalleryPhoto[]) => void;
  onPending: (pending: boolean) => void;
  onRestore: () => void;
  onClear: () => void;
}) {
  const id = useId();
  // Each batch reports its uploads cumulatively; they are appended to the photos shown when it started.
  const { upload, pending, problem, retryFiles, dismiss } =
    useRestaurantImageUpload({
      files: [],
      max: GALLERY_LIMIT - photos.length,
      disabled,
      onChange: (uploaded) =>
        onChange([
          ...photos,
          ...uploaded.map((media) => ({ id: media.id, url: media.url })),
        ]),
      onPending,
      service,
    });
  const busy = disabled || pending;
  function move(index: number, step: -1 | 1) {
    const next = [...photos];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  }
  return (
    <div className="gallery-field">
      <ol className="upload-grid gallery-field-list">
        {photos.map((photo, index) => (
          <li key={photo.id} className="gallery-field-tile">
            <Media src={photo.url} alt={`Ảnh nhà hàng ${index + 1}`} />
            {index === 0 && (
              <span className="photos-current-flag">Ảnh đầu</span>
            )}
            <div className="gallery-field-tools">
              <Button
                variant="icon"
                disabled={busy || index === 0}
                aria-label={`Đưa ảnh ${index + 1} lên trước`}
                onClick={() => move(index, -1)}
              >
                ←
              </Button>
              <Button
                variant="icon"
                disabled={busy || index === photos.length - 1}
                aria-label={`Đưa ảnh ${index + 1} ra sau`}
                onClick={() => move(index, 1)}
              >
                →
              </Button>
              <Button
                variant="icon"
                disabled={busy}
                aria-label={`Bỏ ảnh ${index + 1}`}
                onClick={() => {
                  dismiss();
                  onChange(photos.filter((item) => item.id !== photo.id));
                }}
              >
                ×
              </Button>
            </div>
          </li>
        ))}
        {photos.length < GALLERY_LIMIT && (
          <li className="registration-image-add">
            <span aria-hidden="true">+</span>
            <input
              className="registration-image-input"
              name="imageMediaIds"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              title="Thêm ảnh nhà hàng"
              aria-label="Thêm ảnh nhà hàng"
              aria-describedby={`${id}-help ${id}-error`}
              aria-invalid={!!(error || problem)}
              onChange={(event) => {
                void upload(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </li>
        )}
      </ol>
      <p id={`${id}-help`} className="helper">
        JPG, PNG hoặc WEBP · Tối đa 5 MB mỗi ảnh, {GALLERY_LIMIT} ảnh mỗi quán.
      </p>
      {pending && <p role="status">Đang tải ảnh…</p>}
      <p
        id={`${id}-error`}
        role={error || problem ? "alert" : undefined}
        className="field-error"
      >
        {error || problem}
      </p>
      {!!retryFiles.length && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void upload(retryFiles)}
        >
          Thử tải lại
        </Button>
      )}
      {(changed || !!photos.length) && (
        <div className="actions">
          {changed && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                dismiss();
                onRestore();
              }}
            >
              Khôi phục thư viện đã lưu
            </Button>
          )}
          {!!photos.length && (
            <Button variant="destructive" disabled={busy} onClick={onClear}>
              Xóa toàn bộ ảnh
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
