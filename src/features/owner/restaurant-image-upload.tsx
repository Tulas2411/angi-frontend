"use client";
import "./restaurant-image-upload.css";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/shared/ui";
import { Media } from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { validateRestaurantImage } from "./registration-rules";
import type { RestaurantRegistrationService } from "./restaurant-service";
import type { MediaFileDto } from "./restaurant-types";

export function RestaurantImageUpload({
  label,
  files,
  max,
  disabled,
  error,
  onChange,
  onPending,
  service,
}: {
  label: string;
  files: MediaFileDto[];
  max: number;
  disabled: boolean;
  error?: string;
  onChange: (files: MediaFileDto[]) => void;
  onPending: (pending: boolean) => void;
  service: RestaurantRegistrationService;
}) {
  const id = useId();
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState(false);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function upload(picked: File[]) {
    if (disabled || pending || !picked.length) return;
    if (files.length + picked.length > max) {
      setProblem(`Chỉ được chọn tối đa ${max} ảnh.`);
      return;
    }
    const invalid = picked.map(validateRestaurantImage).find(Boolean);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setProblem("");
    setPending(true);
    onPending(true);
    setRetryFiles([]);
    const uploaded = [...files];
    for (let index = 0; index < picked.length; index++) {
      try {
        const media = await service.upload(picked[index]);
        if (!active.current) return;
        uploaded.push(media);
        onChange([...uploaded]);
      } catch (caught) {
        if (!active.current) return;
        setRetryFiles(picked.slice(index));
        setProblem(
          caught instanceof ApiError &&
            ["FILE_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE"].includes(
              caught.errorCode,
            )
            ? caught.message
            : getErrorMessage(caught),
        );
        break;
      }
    }
    if (active.current) {
      setPending(false);
      onPending(false);
    }
  }
  return (
    <div className="upload-field registration-image-upload">
      <div className="between">
        <span id={`${id}-label`}>{label}</span>
        <span className="helper">
          {files.length} / {max}
        </span>
      </div>
      <p id={`${id}-help`} className="helper">
        JPG, PNG hoặc WEBP · Tối đa 5 MB mỗi ảnh.
      </p>
      <div className="upload-grid">
        {files.map((file) => (
          <div className="upload-tile" key={file.id}>
            <Media src={file.url} alt={label} />
            <Button
              variant="icon"
              disabled={disabled || pending}
              aria-label={`Bỏ ${label.toLocaleLowerCase("vi")} ${file.id}`}
              onClick={() => {
                onChange(files.filter((item) => item.id !== file.id));
                setRetryFiles([]);
                setProblem("");
              }}
            >
              ×
            </Button>
            <span className="helper">
              {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        ))}
        {files.length < max && (
          <div className="registration-image-add">
            <span aria-hidden="true">+</span>
            <input
              id={id}
              className="registration-image-input"
              name={max === 1 ? "coverMediaId" : "imageMediaIds"}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={max > 1}
              disabled={disabled || pending}
              title={`Thêm ${label.toLocaleLowerCase("vi")}`}
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-help ${id}-error`}
              aria-invalid={!!(error || problem)}
              onChange={(event) => {
                void upload(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </div>
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
