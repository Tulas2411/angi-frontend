"use client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/api/error";

/**
 * Short-lived messages about an action the person just took (saved, sent, deleted), shown as a
 * toast by <AppToaster /> (root layout). Field errors, load failures with "Thử lại", lasting states
 * and anything inside a dialog stay inline: a toast leaves by itself, and a modal <dialog> sits
 * above it. See docs/toasts.vi.md.
 */
type Options = { description?: ReactNode; id?: string };

const successMs = 3500;
const errorMs = 6000;

/** The same text again (saving twice in a row) replaces the toast instead of stacking a copy. */
function withId(message: ReactNode, options: Options) {
  return typeof message === "string" && !options.id
    ? { ...options, id: message }
    : options;
}

export const notify = {
  success(message: ReactNode, options: Options = {}) {
    return toast.success(message, {
      duration: successMs,
      ...withId(message, options),
    });
  },
  info(message: ReactNode, options: Options = {}) {
    return toast.info(message, {
      duration: successMs,
      ...withId(message, options),
    });
  },
  warning(message: ReactNode, options: Options = {}) {
    return toast.warning(message, {
      duration: errorMs,
      ...withId(message, options),
    });
  },
  /** A message, or a caught error translated by its errorCode (getErrorMessage). */
  error(problem: unknown, options: Options = {}) {
    const message =
      typeof problem === "string" ? problem : getErrorMessage(problem);
    return toast.error(message, {
      duration: errorMs,
      ...withId(message, options),
    });
  },
};
