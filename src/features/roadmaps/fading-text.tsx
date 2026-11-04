"use client";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * One line of text that fades out at its end only when it is too long for its room, instead of
 * wrapping or ending in "…" (a long restaurant name never pushes what follows it to a new line).
 * The whole text is the tooltip when it is cut. Styles: `.fading-text` in roadmap-detail.css.
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
  const element = useRef<HTMLElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const update = () =>
      setOverflowing(node.scrollWidth > node.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
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
