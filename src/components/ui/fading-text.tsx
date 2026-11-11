"use client";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import "./fading-text.css";

/** True while the element's content is larger than its box; re-measured when the box resizes. */
function useOverflowing(watch: unknown) {
  const element = useRef<HTMLElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const update = () =>
      setOverflowing(
        node.scrollWidth > node.clientWidth + 1 ||
          node.scrollHeight > node.clientHeight + 1,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [watch]);
  return [element, overflowing] as const;
}

/**
 * One line of text that fades out at its end only when it is too long for its room, instead of
 * wrapping or ending in "…" (a long restaurant name never pushes what follows it to a new line).
 * The whole text is the tooltip when it is cut.
 */
export function FadingText({
  text,
  className = "",
  as: Tag = "span",
  children,
}: {
  /** The plain text: shown, and the tooltip when cut. */
  text: string;
  /** Styled content to show instead of `text` (same words). */
  children?: ReactNode;
  className?: string;
  /** The element to render, e.g. "small"; a span by default. */
  as?: ElementType;
}) {
  const [element, overflowing] = useOverflowing(text);
  return (
    <Tag
      ref={element}
      className={`fading-text ${className}`.trim()}
      data-overflowing={overflowing || undefined}
      title={overflowing ? text : undefined}
    >
      {children ?? text}
    </Tag>
  );
}

/**
 * Text of at most `lines` lines; longer text is cut there and its last line fades out (only when
 * it is actually cut). It may also shrink below `lines` when its container has less room.
 */
export function FadingLines({
  text,
  lines,
  className = "",
  as: Tag = "p",
}: {
  text: string;
  lines: number;
  className?: string;
  as?: ElementType;
}) {
  const [element, overflowing] = useOverflowing(text);
  return (
    <Tag
      ref={element}
      className={`fading-lines ${className}`.trim()}
      style={{ "--fading-lines": lines } as CSSProperties}
      data-overflowing={overflowing || undefined}
      title={overflowing ? text : undefined}
    >
      {text}
    </Tag>
  );
}
