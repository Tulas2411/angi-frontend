"use client";
import { useId, useLayoutEffect, useRef, type ChangeEvent } from "react";
import { Field } from "@/components/ui/primitives";
import { applyVndEdit, formatVndInput } from "./roadmap-rules";

/**
 * Money input that shows `1.500.000 VND` while typing. The form keeps only the digits, so
 * validation and the request body never see the separators or the unit.
 */
export function VndField({
  label,
  name,
  value,
  onValueChange,
  placeholder,
  helper,
  error,
}: {
  label: string;
  name: string;
  /** Digits only. */
  value: string;
  onValueChange: (digits: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
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
  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const deleting = /^delete/.test(
      (event.nativeEvent as InputEvent).inputType ?? "",
    );
    const next = applyVndEdit(
      value,
      input.value,
      input.selectionStart ?? input.value.length,
      deleting,
    );
    caret.current = next.caret;
    onValueChange(next.digits);
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
      onChange={change}
    />
  );
}
