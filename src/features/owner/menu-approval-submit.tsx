"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Dialog, TextArea } from "@/components/ui/primitives";
import { ApiError } from "@/shared/api/error";
import {
  menuApprovalIssue,
  menuApprovalRequest,
  validateMenuOwnerNote,
} from "./menu-approval-rules";
import { menuErrorMessage, menuFieldErrors } from "./menu-rules";
import type { RestaurantMenuService } from "./menu-service";
import type { MenuDetailDto, MenuSubmissionDto } from "./menu-types";

export function MenuApprovalSubmit({
  detail,
  note,
  onNoteChange,
  service,
  disabled,
  onSubmitted,
  onRefresh,
}: {
  detail: MenuDetailDto;
  note: string;
  onNoteChange: (value: string) => void;
  service: Pick<RestaurantMenuService, "submit">;
  disabled: boolean;
  onSubmitted: (result: MenuSubmissionDto) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(""),
    [fieldError, setFieldError] = useState<string>();
  const [canRefresh, setCanRefresh] = useState(false);
  const locked = useRef(false),
    active = useRef(true),
    trigger = useRef<HTMLButtonElement | null>(null),
    form = useRef<HTMLFormElement>(null);
  const formId = useId(),
    issue = menuApprovalIssue(detail);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      form.current?.querySelector("textarea")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);
  function close() {
    if (locked.current) return;
    setOpen(false);
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus();
    });
  }
  async function submit() {
    if (locked.current || disabled) return;
    const invalid = validateMenuOwnerNote(note);
    setFieldError(invalid);
    setProblem("");
    if (invalid) {
      form.current?.querySelector("textarea")?.focus();
      return;
    }
    locked.current = true;
    setBusy(true);
    setCanRefresh(false);
    try {
      const result = await service.submit(detail.id, menuApprovalRequest(note));
      if (active.current) onSubmitted(result);
    } catch (error) {
      if (!active.current) return;
      const fields = menuFieldErrors(error);
      setFieldError(fields.ownerNote);
      setProblem(menuErrorMessage(error));
      setCanRefresh(
        error instanceof ApiError &&
          [
            "MENU_EMPTY",
            "MENU_UNCHANGED",
            "SUBMISSION_NOT_EDITABLE",
            "SUBMISSION_NOT_FOUND",
          ].includes(error.errorCode),
      );
      if (fields.ownerNote)
        requestAnimationFrame(() => {
          // Wait until the finally block has re-enabled the textarea.
          if (active.current) form.current?.querySelector("textarea")?.focus();
        });
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  if (detail.status !== "draft") return null;
  return (
    <div className="stack-sm">
      {issue && (
        <Alert tone="info">
          {menuErrorMessage(new ApiError(400, issue, ""))}
        </Alert>
      )}
      <div className="actions">
        <Button
          disabled={disabled || !!issue}
          onClick={(event) => {
            trigger.current = event.currentTarget;
            setOpen(true);
            setProblem("");
            setFieldError(undefined);
            setCanRefresh(false);
          }}
        >
          Gửi duyệt thực đơn
        </Button>
      </div>
      <Dialog
        open={open}
        title="Gửi thực đơn để duyệt?"
        onClose={close}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={close}>
              Để sau
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={busy}
              disabled={disabled}
            >
              Xác nhận gửi duyệt
            </Button>
          </>
        }
      >
        <form
          id={formId}
          ref={form}
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p>
            Bản thực đơn #{detail.id} sẽ chuyển sang chờ duyệt. Bạn không thể
            sửa món trong bản này sau khi gửi. Thực đơn đang bán tiếp tục phục
            vụ cho đến khi thay đổi được duyệt.
          </p>
          <p>
            {detail.items.filter((item) => item.change === "new").length} món
            mới ·{" "}
            {detail.items.filter((item) => item.change === "edited").length} món
            đã sửa · {detail.removedDishes.length} món sẽ bỏ
          </p>
          <TextArea
            label="Ghi chú gửi kiểm duyệt"
            helper="Không bắt buộc, tối đa 1000 ký tự."
            maxLength={1000}
            value={note}
            disabled={busy}
            error={fieldError}
            onChange={(event) => {
              onNoteChange(event.target.value);
              setFieldError(undefined);
            }}
          />
          {problem && <Alert tone="error">{problem}</Alert>}
          {canRefresh && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                close();
                onRefresh();
              }}
            >
              Đóng và tải lại bản thực đơn
            </Button>
          )}
        </form>
      </Dialog>
    </div>
  );
}
