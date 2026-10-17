"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { ConfirmDialog, Dialog, Field } from "@/components/ui/primitives";
import { businessDays, validateBusinessHours } from "./business-hours-rules";
import type { BusinessHourDto } from "./restaurant-types";

type DaySlot = BusinessHourDto & { id: string };

/** Day edits stay local until applied; only the weekly form calls OWN-04. */
export function BusinessHoursDayDialog({
  day,
  add,
  week,
  initialErrors,
  onApply,
  onClose,
}: {
  day: (typeof businessDays)[number];
  add: boolean;
  week: readonly BusinessHourDto[];
  initialErrors: Record<string, string>;
  onApply: (hours: BusinessHourDto[]) => void;
  onClose: () => void;
}) {
  const formId = useId();
  const sequence = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const [original] = useState(() =>
    week
      .flatMap((hour, index) =>
        hour.dayOfWeek === day.dayOfWeek
          ? [{ ...hour, id: `week-${index}` }]
          : [],
      )
      .sort((a, b) => a.openTime.localeCompare(b.openTime)),
  );
  const [slots, setSlots] = useState<DaySlot[]>(() =>
    add
      ? [
          ...original,
          { id: "new", dayOfWeek: day.dayOfWeek, openTime: "", closeTime: "" },
        ]
      : original,
  );
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      original.flatMap((slot) =>
        Object.entries(initialErrors)
          .filter(
            ([key]) =>
              key === `hours[${slot.id.slice(5)}]` ||
              key.startsWith(`hours[${slot.id.slice(5)}].`),
          )
          .map(([key, message]) => [
            `${slot.id}.${key.endsWith(".closeTime") ? "closeTime" : "openTime"}`,
            message,
          ]),
      ),
    ),
  );
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<
    "discard" | { remove: string } | null
  >(null);
  const wire = (rows: readonly DaySlot[]) =>
    rows.map(({ dayOfWeek, openTime, closeTime }) => ({
      dayOfWeek,
      openTime,
      closeTime,
    }));
  const dirty = JSON.stringify(wire(slots)) !== JSON.stringify(wire(original));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const inputs = form.current?.querySelectorAll("input");
      const index = add ? original.length * 2 : 0;
      inputs?.[index]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [add, original.length]);

  function edited(next: DaySlot[]) {
    setSlots(next);
    setErrors({});
    setError("");
  }
  function close() {
    if (dirty) setConfirmation("discard");
    else onClose();
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const others = week.filter((hour) => hour.dayOfWeek !== day.dayOfWeek);
    const candidate = [...others, ...wire(slots)];
    const result = validateBusinessHours(candidate);
    if (!result.errorCode) {
      onApply(wire(slots));
      return;
    }
    const fields: Record<string, string> = {};
    const affected = new Set<string>();
    Object.entries(result.errors).forEach(([key, message]) => {
      const match = /^hours\[(\d+)\]\.(\w+)$/.exec(key);
      if (!match) return;
      const index = Number(match[1]);
      const label = businessDays.find(
        (entry) => entry.dayOfWeek === candidate[index]?.dayOfWeek,
      )?.label;
      if (label) affected.add(label);
      const slot = slots[index - others.length];
      if (slot) fields[`${slot.id}.${match[2]}`] = message;
    });
    setErrors(fields);
    setError(
      result.errorCode === "INVALID_BUSINESS_HOURS"
        ? `Các khoảng phục vụ không được chồng nhau, kể cả qua nửa đêm. Kiểm tra: ${[...affected].join(", ")}.`
        : "Nhập đủ giờ mở và giờ đóng theo định dạng 24 giờ (HH:mm); hai giờ phải khác nhau.",
    );
    requestAnimationFrame(() => {
      const control = form.current?.elements.namedItem(
        Object.keys(fields)[0] ?? "",
      );
      if (control instanceof HTMLElement) control.focus();
    });
  }

  return (
    <>
      <Dialog
        open
        title={`${add ? "Thêm khoảng" : "Chỉnh giờ"} · ${day.label}`}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Hủy
            </Button>
            <Button type="submit" form={formId}>
              Áp dụng
            </Button>
          </>
        }
      >
        <form
          id={formId}
          ref={form}
          noValidate
          onSubmit={apply}
          className="stack business-hours-day-editor"
        >
          <p className="helper">
            Giờ Việt Nam (UTC+7). Giờ đóng sớm hơn giờ mở là đóng vào ngày hôm
            sau. Các khoảng được phép nối tiếp nhau.
          </p>
          {error && <Alert>{error}</Alert>}
          {!slots.length && (
            <p>
              Chưa khai báo giờ. Bạn có thể thêm khoảng phục vụ cho ngày này.
            </p>
          )}
          {slots.map((slot, index) => (
            <fieldset
              className="registration-fields business-hours-slot"
              key={slot.id}
            >
              <legend>Khoảng {index + 1}</legend>
              <div className="business-hours-slot-fields">
                <Field
                  label={`Giờ mở · ${day.label} · khoảng ${index + 1}`}
                  type="time"
                  step={60}
                  required
                  name={`${slot.id}.openTime`}
                  value={slot.openTime}
                  error={errors[`${slot.id}.openTime`]}
                  onChange={(event) =>
                    edited(
                      slots.map((entry) =>
                        entry.id === slot.id
                          ? { ...entry, openTime: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <Field
                  label={`Giờ đóng · ${day.label} · khoảng ${index + 1}`}
                  type="time"
                  step={60}
                  required
                  name={`${slot.id}.closeTime`}
                  value={slot.closeTime}
                  error={errors[`${slot.id}.closeTime`]}
                  onChange={(event) =>
                    edited(
                      slots.map((entry) =>
                        entry.id === slot.id
                          ? { ...entry, closeTime: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
              </div>
              {slot.openTime &&
                slot.closeTime &&
                slot.closeTime < slot.openTime && (
                  <p className="helper">
                    Đóng lúc {slot.closeTime} ngày hôm sau.
                  </p>
                )}
              <Button
                variant="tertiary"
                aria-label={`Xóa khoảng ${index + 1} · ${day.label}`}
                onClick={() => setConfirmation({ remove: slot.id })}
              >
                Xóa khoảng
              </Button>
            </fieldset>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              edited([
                ...slots,
                {
                  id: `added-${sequence.current++}`,
                  dayOfWeek: day.dayOfWeek,
                  openTime: "",
                  closeTime: "",
                },
              ])
            }
          >
            Thêm khoảng giờ
          </Button>
          <p className="helper">
            Áp dụng để cập nhật bản nháp. Chọn “Lưu cả tuần” để lưu vào hệ
            thống.
          </p>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!confirmation}
        title={
          confirmation === "discard"
            ? "Bỏ thay đổi của ngày này?"
            : "Xóa khoảng phục vụ?"
        }
        label={confirmation === "discard" ? "Bỏ thay đổi" : "Xóa khoảng"}
        cancelLabel="Tiếp tục chỉnh sửa"
        destructive
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation === "discard") onClose();
          else if (confirmation)
            edited(slots.filter((slot) => slot.id !== confirmation.remove));
          setConfirmation(null);
        }}
      >
        <p>
          {confirmation === "discard"
            ? "Những thay đổi chưa áp dụng của ngày này sẽ bị bỏ. Bản nháp lịch tuần vẫn được giữ nguyên."
            : "Khoảng này sẽ được bỏ khỏi bản nháp sau khi áp dụng. Ngày không còn khoảng phục vụ sẽ hiển thị Chưa khai báo giờ."}
        </p>
      </ConfirmDialog>
    </>
  );
}
