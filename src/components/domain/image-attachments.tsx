"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/shared/ui";
import { Icon, Media } from "@/components/ui/primitives";
import { getErrorMessage } from "@/shared/api/error";
import { validateUpload } from "@/shared/format";
import "./image-attachments.css";

export interface Attachment {
  /** `media_files.id` from MEDIA-01, sent as `imageMediaIds`, `evidenceMediaIds` and so on. */
  mediaId: number;
  url: string;
  name: string;
}

/**
 * Photos for a review, a report or a blog. Every file is uploaded at once (MEDIA-01) so the form
 * only holds ids the backend already knows; a failed file is reported and the others are kept.
 */
export function ImageAttachments({
  label,
  helper,
  max,
  value,
  onChange,
  onUploading,
  upload,
  addLabel = "Chọn ảnh",
}: {
  label: string;
  helper: string;
  max: number;
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  onUploading: (uploading: boolean) => void;
  /** Uploads one file with the purpose of the form; rejects with the backend's error. */
  upload: (file: File) => Promise<{ id: number; url: string }>;
  addLabel?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function pick(files: File[]) {
    if (!files.length || busy) return;
    if (value.length + files.length > max) {
      setProblem(`Chỉ đính kèm tối đa ${max} ảnh.`);
      return;
    }
    const invalid = files.map((file) => validateUpload(file)).find(Boolean);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setProblem("");
    setBusy(true);
    onUploading(true);
    const added: Attachment[] = [];
    let failure = "";
    for (const file of files) {
      try {
        const media = await upload(file);
        added.push({ mediaId: media.id, url: media.url, name: file.name });
      } catch (caught) {
        failure = `Chưa tải được “${file.name}”: ${getErrorMessage(caught)}`;
      }
    }
    if (!mounted.current) return;
    if (added.length) onChange([...value, ...added]);
    setProblem(failure);
    setBusy(false);
    onUploading(false);
  }

  return (
    <div className="field attachments">
      <div className="between">
        <label htmlFor={id}>{label}</label>
        <span className="helper">
          {value.length} / {max}
        </span>
      </div>
      <p className="helper">{helper}</p>
      <input
        id={id}
        ref={input}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        disabled={busy || value.length >= max}
        onChange={(event) => {
          void pick(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        suppressHydrationWarning
      />
      <ul className="attachment-list">
        {value.map((file) => (
          <li key={file.mediaId}>
            <Media src={file.url} alt={file.name} />
            <Button
              variant="icon"
              aria-label={`Bỏ ảnh ${file.name}`}
              disabled={busy}
              onClick={() =>
                onChange(value.filter((item) => item.mediaId !== file.mediaId))
              }
            >
              <Icon name="trash" />
            </Button>
          </li>
        ))}
        {value.length < max && (
          <li>
            <button
              type="button"
              className="attachment-add"
              disabled={busy}
              onClick={() => input.current?.click()}
              suppressHydrationWarning
            >
              <span aria-hidden>＋</span>
              {busy ? "Đang tải ảnh…" : addLabel}
            </button>
          </li>
        )}
      </ul>
      {problem && (
        <p role="alert" className="field-error">
          {problem}
        </p>
      )}
    </div>
  );
}
