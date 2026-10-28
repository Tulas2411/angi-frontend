"use client";
import { useEffect, useId, useRef, useState } from "react";

export interface NavDropdownItem {
  href: string;
  label: string;
  description?: string;
}

/**
 * Header navigation entry that opens a small panel of links (disclosure
 * pattern: a button with aria-expanded controlling the panel). Closes on
 * outside click, Escape (focus returns to the button), blur, resize and link choice.
 */
export function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: readonly NavDropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <div className="nav-dropdown" ref={root} data-open={open}>
      <button
        ref={trigger}
        type="button"
        className="nav-dropdown-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <svg
          className="nav-dropdown-chevron"
          viewBox="0 0 12 12"
          aria-hidden
          focusable="false"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      <div
        id={panelId}
        className="nav-dropdown-panel"
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {items.map((item, index) => (
          <a key={item.href} href={item.href} className="nav-dropdown-item">
            <span className="nav-dropdown-index" aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{item.label}</strong>
              {item.description && <small>{item.description}</small>}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
