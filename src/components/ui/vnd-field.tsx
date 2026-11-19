"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { Field } from "@/components/ui/primitives";
import {
  applyVndEdit,
  formatVndInput,
  vndDigitsFromPaste,
} from "@/shared/money/vnd-input";

/**
 * Money input that shows `1.500.000 VND` while typing. The form keeps only the digits, so
 * validation and the request body never see the separators or the unit. It is a text input, so the
 * mouse wheel never changes the amount, and a pasted "45.000" means 45 000 đồng (a number input would
 * read the dot as a decimal point and keep 45).
 */
export function VndField({
  label,
  name,
  value,
  onValueChange,
  placeholder,
  helper,
  error,
  maxDigits = 14,
  required,
  disabled,
}: {
  label: string;
  name: string;
  /** Digits only. */
  value: string;
  onValueChange: (digits: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  /** Longest amount accepted, in digits. */
  maxDigits?: number;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const caret = useRef<number | null>(null);
  // Restore the caret after React writes the formatted text back into the input.
  useLayoutEffect(() => {
    if (caret.current === null) return;
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement && document.activeElement === input)
      input.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  function apply(typed: string, position: number, deleting: boolean) {
    const next = applyVndEdit(value, typed, position, deleting, maxDigits);
    caret.current = next.caret;
    onValueChange(next.digits);
  }
  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const deleting = /^delete/.test(
      (event.nativeEvent as InputEvent).inputType ?? "",
    );
    apply(input.value, input.selectionStart ?? input.value.length, deleting);
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = vndDigitsFromPaste(event.clipboardData.getData("text"));
    event.preventDefault();
    if (!pasted) return;
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const typed = input.value.slice(0, start) + pasted + input.value.slice(end);
    apply(typed, start + pasted.length, false);
  }
  return (
    <Field
      id={id}
      label={label}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatVndInput(value)}
      placeholder={placeholder}
      helper={helper}
      error={error}
      required={required}
      disabled={disabled}
      onChange={change}
      onPaste={paste}
    />
  );
}
