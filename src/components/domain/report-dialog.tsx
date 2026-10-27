"use client";
import { useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Choice, Dialog, TextArea } from "@/components/ui/primitives";
import { ImageAttachments, type Attachment } from "./image-attachments";
import {
  maxReportEvidence,
  maxReportLength,
  reportProblems,
} from "@/shared/report-rules";
import "./report-dialog.css";

export interface ReportReason<Code extends string> {
  value: Code;
  label: string;
}

export interface ReportRequest<Code extends string> {
  reasonCode: Code;
  description?: string;
  evidenceMediaIds?: number[];
}

/**
 * A Traveler reports a restaurant (REP-01) or a blog (REP-02): the reason, an optional description
 * and up to five photos uploaded with MEDIA-01 (`report_evidence`). The report waits for a Moderator.
 */
export function ReportDialog<Code extends string>({
  title,
  reasons,
  send,
  upload,
  errorOf,
  open,
  onClose,
  onSent,
}: {
  title: string;
  reasons: readonly ReportReason<Code>[];
  send: (request: ReportRequest<Code>) => Promise<unknown>;
  upload: (file: File) => Promise<{ id: number; url: string }>;
  /** `settled` means the report is already there (409), so there is nothing to retry. */
  errorOf: (error: unknown) => { settled: boolean; message: string };
  open: boolean;
  onClose: () => void;
  /** `already` is true when a report of this traveler was already waiting. */
  onSent: (already: boolean) => void;
}) {
  const [reason, setReason] = useState<Code>(reasons[0].value);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<{ description?: string }>({});
  const [failure, setFailure] = useState("");
  const sending = useRef(false);

  function close() {
    if (sending.current || uploading) return;
    onClose();
  }

  async function submit() {
    if (sending.current || uploading) return;
    const found = reportProblems(reason, description);
    setProblems(found);
    setFailure("");
    if (found.description) return;
    sending.current = true;
    setBusy(true);
    try {
      await send({
        reasonCode: reason,
        description: description.trim() || undefined,
        evidenceMediaIds: evidence.length
          ? evidence.map((file) => file.mediaId)
          : undefined,
      });
      onSent(false);
    } catch (caught) {
      const result = errorOf(caught);
      if (result.settled) onSent(true);
      else setFailure(result.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Hủy
          </Button>
          <Button
            onClick={() => void submit()}
            loading={busy}
            disabled={uploading}
          >
            Gửi báo cáo
          </Button>
        </>
      }
    >
      <form
        className="stack-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <fieldset className="report-reasons">
          <legend>Lý do báo cáo</legend>
          {reasons.map((item) => (
            <Choice
              key={item.value}
              kind="radio"
              name="report-reason"
              label={item.label}
              checked={reason === item.value}
              onChange={() => setReason(item.value)}
            />
          ))}
        </fieldset>
        <TextArea
          label="Mô tả chi tiết"
          value={description}
          maxLength={maxReportLength}
          required={reason === "other"}
          onChange={(event) => setDescription(event.target.value)}
          helper="Mô tả cụ thể giúp bộ phận kiểm duyệt xử lý nhanh hơn."
          error={problems.description}
        />
        <ImageAttachments
          label="Ảnh bằng chứng"
          helper="Tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh dưới 5 MB."
          max={maxReportEvidence}
          value={evidence}
          onChange={setEvidence}
          onUploading={setUploading}
          upload={upload}
        />
        {failure && <Alert>{failure}</Alert>}
      </form>
    </Dialog>
  );
}
