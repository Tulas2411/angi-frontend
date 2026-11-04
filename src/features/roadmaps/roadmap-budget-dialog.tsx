"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { Dialog } from "@/components/ui/primitives";
import { ApiError } from "@/shared/api/error";
import {
  budgetDigits,
  buildBudgetPatch,
  roadmapErrorMessage,
  roadmapFieldErrors,
} from "./roadmap-rules";
import type { RoadmapScreenService } from "./roadmap-service";
import type { RoadmapDetailDto } from "./roadmap-types";
import { VndField } from "./vnd-field";

/**
 * Budget editor of the detail page: RM-04 with only `budgetAmount`. The page shows the
 * returned RoadmapDetail, so costs and the remaining amount stay the backend's.
 */
export function RoadmapBudgetDialog({
  roadmapId,
  budgetAmount,
  service,
  onClose,
  onSaved,
}: {
  roadmapId: number;
  budgetAmount: number | null;
  service: Pick<RoadmapScreenService, "update">;
  onClose: () => void;
  onSaved: (detail: RoadmapDetailDto) => void;
}) {
  const id = useId();
  const [digits, setDigits] = useState(() => budgetDigits(budgetAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const submitting = useRef(false);
  const patch = buildBudgetPatch(digits, budgetAmount);
  const unchanged = Object.keys(patch).length === 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (unchanged) {
      onClose();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      onSaved(await service.update(roadmapId, patch));
    } catch (caught) {
      // The typed amount stays in the field so the traveler can retry.
      const fields =
        caught instanceof ApiError ? roadmapFieldErrors(caught.errors) : {};
      setFieldError(fields.budgetAmount);
      setError(roadmapErrorMessage(caught));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title={budgetAmount === null ? "Đặt ngân sách" : "Sửa ngân sách"}
      onClose={busy ? () => undefined : onClose}
      focusField
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" form={id} loading={busy}>
            Lưu ngân sách
          </Button>
        </>
      }
    >
      <form id={id} className="stack" onSubmit={submit} noValidate>
        {error && <Alert>{error}</Alert>}
        <VndField
          label="Ngân sách dự kiến"
          name="budgetAmount"
          value={digits}
          placeholder="Ví dụ: 1.500.000 VND"
          helper="Cho mỗi người, cả chuyến. Để trống để bỏ ngân sách."
          error={fieldError}
          onValueChange={setDigits}
        />
      </form>
    </Dialog>
  );
}
