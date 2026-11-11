"use client";
import "./restaurant-image-upload.css";
import { useId } from "react";
import { Button } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { useRestaurantImageUpload } from "./restaurant-image-upload";
import type { RestaurantRegistrationService } from "./restaurant-service";
import type { MediaFileDto } from "./restaurant-types";

/**
 * One cover slot previewed at the overview banner ratio (4:1).
 * Shows the new upload, else the saved cover unless it is being removed.
 */
export function RestaurantCoverField({
  savedUrl,
  files,
  cleared,
  disabled,
  error,
  service,
  onChange,
  onPending,
  onRemove,
  onRestore,
}: {
  savedUrl: string | null;
  files: MediaFileDto[];
  cleared: boolean;
  disabled: boolean;
  error?: string;
  service: Pick<RestaurantRegistrationService, "upload">;
  onChange: (files: MediaFileDto[]) => void;
  onPending: (pending: boolean) => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  const id = useId();
  // A new pick replaces the previous one, so uploads always start from an empty slot.
  const { upload, pending, problem, retryFiles, dismiss } =
    useRestaurantImageUpload({
      files: [],
      max: 1,
      disabled,
      onChange,
      onPending,
      service,
    });
  const shown = files[0]?.url ?? (cleared ? null : savedUrl);
  const changed = !!files.length || cleared;
  const pick = shown ? "Đổi ảnh bìa" : "Thêm ảnh bìa";
  return (
    <div className="cover-field">
      <div className="cover-field-frame">
        {shown ? (
          <Media src={shown} alt="Ảnh bìa" />
        ) : (
          <div className="cover-field-empty">
            {cleared ? "Ảnh bìa sẽ được bỏ khi lưu" : "Chưa có ảnh bìa"}
          </div>
        )}
        {changed && <span className="cover-field-flag">Chưa lưu</span>}
      </div>
      <p id={`${id}-help`} className="helper">
        Hiện dạng banner 4:1 ở đầu trang tổng quan, nên chọn ảnh ngang. JPG, PNG
        hoặc WEBP · Tối đa 5 MB.
      </p>
      <div className="actions">
        <label
          className={`button button-secondary cover-field-pick${disabled || pending ? " is-disabled" : ""}`}
        >
          {pick}
          <input
            className="registration-image-input"
            name="coverMediaId"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || pending}
            aria-describedby={`${id}-help ${id}-error`}
            aria-invalid={!!(error || problem)}
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>
        {shown && (
          <Button
            variant="secondary"
            disabled={disabled || pending}
            onClick={() => {
              dismiss();
              onRemove();
            }}
          >
            Bỏ ảnh bìa
          </Button>
        )}
        {changed && savedUrl && (
          <Button
            variant="secondary"
            disabled={disabled || pending}
            onClick={() => {
              dismiss();
              onRestore();
            }}
          >
            Khôi phục ảnh bìa đã lưu
          </Button>
        )}
      </div>
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
          disabled={disabled || pending}
          onClick={() => void upload(retryFiles)}
        >
          Thử tải lại
        </Button>
      )}
    </div>
  );
}
