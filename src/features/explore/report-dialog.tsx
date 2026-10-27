"use client";
import { useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Choice, Dialog, TextArea } from "@/components/ui/primitives";
import { ImageAttachments, type Attachment } from "./explore-attachments";
import {
  maxReportEvidence,
  maxReportLength,
  reportError,
  reportProblems,
  reportReasons,
} from "./explore-rules";
import type { ExploreService } from "./explore-service";
import type { ReportReasonCode } from "./explore-types";

/** REP-01: a Traveler reports a restaurant; the report waits for a Moderator (status `pending`). */
export function ReportDialog({
  restaurantId,
  restaurantName,
  service,
  open,
  onClose,
  onSent,
}: {
  restaurantId: number;
  restaurantName: string;
  service: Pick<ExploreService, "reportRestaurant" | "upload">;
  open: boolean;
  onClose: () => void;
  /** `already` is true when a report of this traveler was already waiting. */
  onSent: (already: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReasonCode>("wrong_info");
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
      await service.reportRestaurant(restaurantId, {
        reasonCode: reason,
        description: description.trim() || undefined,
        evidenceMediaIds: evidence.length
          ? evidence.map((file) => file.mediaId)
          : undefined,
      });
      onSent(false);
    } catch (caught) {
      const result = reportError(caught);
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
      title={`Báo cáo ${restaurantName}`}
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
        <fieldset className="explore-reasons">
          <legend>Lý do báo cáo</legend>
          {reportReasons.map((item) => (
            <Choice
              key={item.value}
              kind="radio"
              name="restaurant-report-reason"
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
          purpose="report_evidence"
          max={maxReportEvidence}
          value={evidence}
          onChange={setEvidence}
          onUploading={setUploading}
          service={service}
        />
        {failure && <Alert>{failure}</Alert>}
      </form>
    </Dialog>
  );
}
