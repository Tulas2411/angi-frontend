"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/shared/ui";
import { SelectField } from "@/components/ui/primitives";
import {
  validateVerificationFile,
  verificationErrorMessage,
  verificationDocumentTypes,
} from "./verification-rules";
import type { VerificationService } from "./verification-service";
import type { VerificationDocumentSelection } from "./restaurant-types";
import { verificationDocumentUrl } from "./verification-details";

export function VerificationDocumentUpload({
  documents,
  disabled,
  errors,
  service,
  onChange,
  onPending,
  onRemove,
  resubmitting = false,
}: {
  documents: VerificationDocumentSelection[];
  disabled: boolean;
  errors: Record<string, string>;
  service: Pick<VerificationService, "upload">;
  onChange: (documents: VerificationDocumentSelection[]) => void;
  onPending: (pending: boolean) => void;
  onRemove: (document: VerificationDocumentSelection) => void;
  resubmitting?: boolean;
}) {
  const id = useId();
  const alive = useRef(true);
  const uploading = useRef(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const [retry, setRetry] = useState<File[]>([]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function upload(files: File[]) {
    if (disabled || uploading.current || !files.length) return;
    const invalid = files.map(validateVerificationFile).find(Boolean);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    uploading.current = true;
    setPending(true);
    onPending(true);
    setProblem("");
    setRetry([]);
    const uploaded = [...documents];
    try {
      for (let index = 0; index < files.length; index++) {
        try {
          const media = await service.upload(files[index]);
          if (!alive.current) return;
          if (
            !Number.isSafeInteger(media.id) ||
            media.id <= 0 ||
            media.purpose !== "verification_doc"
          )
            throw new Error(
              "Tệp tải lên chưa hợp lệ cho hồ sơ xác minh. Vui lòng thử lại.",
            );
          uploaded.push({
            key: crypto.randomUUID(),
            fileName: files[index].name,
            media,
            docType: "business_license",
          });
          onChange([...uploaded]);
        } catch (caught) {
          if (!alive.current) return;
          setProblem(verificationErrorMessage(caught));
          setRetry(files.slice(index));
          break;
        }
      }
    } finally {
      uploading.current = false;
      if (alive.current) {
        setPending(false);
        onPending(false);
      }
    }
  }
  return (
    <div className="verification-documents">
      <p id={`${id}-help`} className="helper">
        Ảnh JPG, PNG, WEBP tối đa 5 MB; PDF tối đa 10 MB.{" "}
        {resubmitting
          ? "Chọn bộ tài liệu đầy đủ cho lần gửi lại, gồm ít nhất một tài liệu."
          : "Cần ít nhất một giấy phép kinh doanh."}
      </p>
      <div className="verification-document-grid">
        {documents.map((document, index) => (
          <section
            key={document.key}
            className="verification-document"
            aria-label={`Tài liệu ${document.fileName}`}
          >
            <div className="between">
              <strong className="verification-file-name">
                {document.fileName}
              </strong>
              <Button
                variant="icon"
                className="verification-remove"
                aria-label={`Bỏ tài liệu ${document.fileName}`}
                disabled={disabled || pending}
                onClick={() => onRemove(document)}
              >
                ×
              </Button>
            </div>
            {"retained" in document ? (
              <>
                <p className="helper">
                  Tài liệu từ hồ sơ trước · Sẽ được giữ trong lần gửi lại
                </p>
                {verificationDocumentUrl(document.media.url) && (
                  <a
                    href={
                      verificationDocumentUrl(document.media.url) ?? undefined
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở tài liệu #{document.media.id}
                  </a>
                )}
              </>
            ) : (
              <p className="helper">
                {document.media.mimeType === "application/pdf" ? "PDF" : "Ảnh"}{" "}
                · {(document.media.sizeBytes / 1024 / 1024).toFixed(1)} MB · Đã
                tải lên
              </p>
            )}
            <SelectField
              label={`Loại tài liệu · ${document.fileName}`}
              name={`documents[${index}].docType`}
              value={document.docType}
              options={verificationDocumentTypes}
              disabled={disabled || pending}
              error={errors[`documents[${index}].docType`]}
              onChange={(value) => {
                const type = verificationDocumentTypes.find(
                  (item) => item.value === value,
                );
                if (type)
                  onChange(
                    documents.map((item) =>
                      item.key === document.key
                        ? { ...item, docType: type.value }
                        : item,
                    ),
                  );
              }}
            />
            {errors[`documents[${index}].mediaId`] && (
              <p className="field-error" role="alert">
                {errors[`documents[${index}].mediaId`]}
              </p>
            )}
          </section>
        ))}
        <div className="verification-add-document">
          <span aria-hidden="true">+</span>
          <span aria-hidden="true">Thêm tài liệu</span>
          <input
            type="file"
            name="documents"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            disabled={disabled || pending}
            aria-label="Thêm tài liệu xác minh"
            aria-describedby={`${id}-help ${id}-error`}
            aria-invalid={!!(errors.documents || problem)}
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>
      </div>
      {pending && <p role="status">Đang tải tài liệu…</p>}
      <p
        id={`${id}-error`}
        className="field-error"
        role={errors.documents || problem ? "alert" : undefined}
      >
        {errors.documents || problem}
      </p>
      {!!retry.length && (
        <Button
          variant="secondary"
          disabled={disabled || pending}
          onClick={() => void upload(retry)}
        >
          Thử tải lại tài liệu
        </Button>
      )}
    </div>
  );
}
