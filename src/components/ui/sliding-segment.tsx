"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type RefObject,
} from "react";
import "./sliding-segment.css";

/** The selected child: a `button[aria-pressed="true"]` or the label of a checked radio. */
function activeChild(root: HTMLElement): HTMLElement | null {
  const pressed = root.querySelector<HTMLElement>(
    ':scope > button[aria-pressed="true"]',
  );
  if (pressed) return pressed;
  const checked = root.querySelector<HTMLInputElement>(
    ":scope > label > input:checked",
  );
  return checked?.parentElement ?? null;
}

/**
 * Moves one shared pill under the selected item of a segmented control. The pill is the
 * container's `::before`, positioned from CSS variables; the first position is set without
 * animation so the pill does not slide in from the left edge on load.
 */
export function useSlidingIndicator(ref: RefObject<HTMLElement | null>) {
  const animate = useRef(false);

  const measure = () => {
    const root = ref.current;
    if (!root) return;
    const active = activeChild(root);
    root.dataset.hasActive = String(!!active);
    if (!active) return;
    root.style.setProperty("--seg-x", `${active.offsetLeft}px`);
    root.style.setProperty("--seg-y", `${active.offsetTop}px`);
    root.style.setProperty("--seg-w", `${active.offsetWidth}px`);
    root.style.setProperty("--seg-h", `${active.offsetHeight}px`);
    root.dataset.activeChoice = active.dataset.choice ?? "";
  };

  // Every render: the selection is React state, so a render is when it can change.
  useLayoutEffect(() => {
    measure();
    if (!animate.current && ref.current) {
      const root = ref.current;
      const frame = requestAnimationFrame(() => {
        animate.current = true;
        root.dataset.animate = "true";
      });
      return () => cancelAnimationFrame(frame);
    }
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    for (const child of Array.from(root.children)) observer.observe(child);
    // Uncontrolled radios and late web fonts change the geometry without a render.
    root.addEventListener("change", measure);
    void document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      root.removeEventListener("change", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** A `div` group whose selected button (or checked radio label) is marked by a sliding pill. */
export function SlidingSegment({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useSlidingIndicator(ref);
  return (
    <div ref={ref} {...props} className={`${className} sliding-segment`.trim()}>
      {children}
    </div>
  );
}
