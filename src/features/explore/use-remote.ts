"use client";
import { useEffect, useRef, useState } from "react";

export type Remote<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };

/**
 * Loads once per `key` (and again on `retry`). While the key changed and the new answer has not
 * arrived the state is `loading`, so a filter change never shows the previous result as current.
 * A load that is no longer wanted (the key changed, the page closed) is cancelled through `signal`,
 * so a quick series of searches does not keep every older request running.
 */
export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
): [Remote<T>, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<{
    id: string;
    result: { data: T } | { error: unknown };
  } | null>(null);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const id = `${key}#${attempt}`;
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    loader
      .current(controller.signal)
      .then((data) => {
        if (!ignore) setAnswer({ id, result: { data } });
      })
      .catch((error: unknown) => {
        if (!ignore) setAnswer({ id, result: { error } });
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [id]);
  const state: Remote<T> =
    !answer || answer.id !== id
      ? { status: "loading" }
      : "data" in answer.result
        ? { status: "ready", data: answer.result.data }
        : { status: "error", error: answer.result.error };
  return [state, () => setAttempt((value) => value + 1)];
}
