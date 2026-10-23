"use client";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Button, Input } from "@/shared/ui";
import { searchText } from "@/shared/text/search";

/** Local SVG icons from the design export (decorative; never the only label). */
export function Icon({
  name,
}: {
  name: "search" | "X" | "Plus" | "Minus" | "LocateFixed";
}) {
  return (
    <span className={`icon icon-${name}`} aria-hidden>
      <img src={`/assets/figma/${name}.svg`} alt="" />
    </span>
  );
}
export function ActionLink({
  href,
  children,
  secondary = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`button button-${secondary ? "secondary" : "primary"} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
export function Field({
  label,
  helper,
  error,
  id: suppliedId,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
  error?: string;
}) {
  const generated = useId(),
    id = suppliedId ?? generated;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && " *"}
      </label>
      <Input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={helper || error ? `${id}-help` : undefined}
      />
      <p className={error ? "field-error" : "helper"} id={`${id}-help`}>
        {error || helper}
      </p>
    </div>
  );
}
/** Password input with an accessible show/hide toggle. */
export function PasswordField({
  label,
  helper,
  error,
  id: suppliedId,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  helper?: string;
  error?: string;
}) {
  const generated = useId(),
    id = suppliedId ?? generated,
    [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && " *"}
      </label>
      <div className="password-row">
        <Input
          {...props}
          id={id}
          type={shown ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={helper || error ? `${id}-help` : undefined}
        />
        <Button
          variant="secondary"
          aria-pressed={shown}
          aria-controls={id}
          disabled={props.disabled}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? "Ẩn" : "Hiện"}
        </Button>
      </div>
      <p className={error ? "field-error" : "helper"} id={`${id}-help`}>
        {error || helper}
      </p>
    </div>
  );
}
export function TextArea({
  label,
  helper,
  error,
  id: suppliedId,
  value,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  helper?: string;
  error?: string;
}) {
  const generated = useId(),
    id = suppliedId ?? generated;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && " *"}
      </label>
      <textarea
        {...props}
        id={id}
        value={value}
        className={`input textarea ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={`${id}-help`}
        suppressHydrationWarning
      />
      <div className="between helper" id={`${id}-help`}>
        <span className={error ? "field-error" : ""}>{error || helper}</span>
        {props.maxLength && (
          <span>
            {String(value ?? "").length} / {props.maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
export function SelectField({
  label,
  name,
  error,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  name?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        className="input"
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        suppressHydrationWarning
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function Choice({
  label,
  checked,
  onChange,
  disabled = false,
  kind = "checkbox",
  name,
  value,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  kind?: "checkbox" | "radio" | "switch";
  name?: string;
  value?: string;
}) {
  return (
    <label className={`choice ${disabled ? "is-disabled" : ""}`}>
      <input
        type={kind === "radio" ? "radio" : "checkbox"}
        role={kind === "switch" ? "switch" : undefined}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        name={name}
        value={value}
        suppressHydrationWarning
      />
      <span
        className={kind === "switch" ? "switch-track" : "choice-mark"}
        aria-hidden
      />
      {label}
    </label>
  );
}
export function Tabs({
  items,
  value,
  onChange,
  label = "Lựa chọn",
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          type="button"
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          id={`${id}-${item.value}`}
          tabIndex={value === item.value ? 0 : -1}
          className={`chip ${value === item.value ? "selected" : ""}`}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % items.length;
            else if (event.key === "ArrowLeft")
              next = (index + items.length - 1) % items.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = items.length - 1;
            else return;
            event.preventDefault();
            onChange(items[next].value);
            document.getElementById(`${id}-${items[next].value}`)?.focus();
          }}
          suppressHydrationWarning
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  map = false,
  drawer = false,
  focusField = false,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  map?: boolean;
  drawer?: boolean;
  /** Forms move initial focus to their first field instead of the close button. */
  focusField?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const returnFocus =
      open && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (open && !dialog.open) {
      dialog.showModal();
      if (focusField)
        dialog
          .querySelector<HTMLElement>(
            ".dialog-content :is(input, textarea, select)",
          )
          ?.focus();
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [open, focusField]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${map ? "dialog-map" : ""} ${drawer ? "dialog-drawer" : ""} ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Button variant="icon" onClick={onClose} aria-label="Đóng hộp thoại">
          <Icon name="X" />
        </Button>
      </div>
      <div className="dialog-content">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  destructive = false,
  loading = false,
  label = "Xác nhận",
  cancelLabel = "Hủy",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
  label?: string;
  cancelLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {label}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
export function EmptyState({
  title = "Chưa có nội dung",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden className="empty-symbol">
        ◎
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Đang tải" className="stack">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
      <span className="sr-only">Đang tải nội dung…</span>
    </div>
  );
}
export function Avatar({
  name,
  image,
  className = "",
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`avatar ${className}`.trim()}>
      {image && image !== failed ? (
        <img src={image} alt={name} onError={() => setFailed(image)} />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}
/** Image from a backend record; a missing or broken image shows a neutral placeholder. */
export function Media({
  src,
  alt,
  className = "",
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  return (
    <div className={`media ${className}`.trim()}>
      {src && src !== failed ? (
        <img src={src} alt={alt} onError={() => setFailed(src)} />
      ) : (
        <div className="media-fallback">
          <span aria-hidden>▧</span>
          <span>Chưa có ảnh · {alt}</span>
        </div>
      )}
    </div>
  );
}
export function Combobox({
  label,
  value,
  onChange,
  options,
  helper,
  error,
  id: suppliedId,
  onKeyDown,
  onClick,
  onFocus,
  onBlur,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  helper?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    generatedId = useId();
  const id = suppliedId ?? generatedId;
  const matches = options.filter((o) =>
    searchText(o).includes(searchText(value)),
  );
  const expanded = open && matches.length > 0;
  const activeOption = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (expanded) activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [active, expanded, value, options]);
  return (
    <div className="field combobox">
      <label htmlFor={id}>
        {label}
        {props.required && " *"}
      </label>
      <Input
        {...props}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-list` : undefined}
        aria-activedescendant={
          expanded && matches[active] ? `${id}-${active}` : undefined
        }
        aria-invalid={!!error}
        aria-describedby={helper || error ? `${id}-help` : undefined}
        value={value}
        onClick={(event) => {
          setOpen(true);
          onClick?.(event);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          onBlur?.(event);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && expanded) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              !open ? 0 : Math.max(0, Math.min(i + 1, matches.length - 1)),
            );
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              !open ? Math.max(0, matches.length - 1) : Math.max(0, i - 1),
            );
          }
          if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            e.stopPropagation();
            onChange(matches[active]);
            setOpen(false);
          }
          if (!e.defaultPrevented) onKeyDown?.(e);
        }}
      />
      {expanded && (
        <ul role="listbox" id={`${id}-list`} className="combobox-options">
          {matches.map((o, i) => (
            <li
              key={o}
              ref={i === active ? activeOption : undefined}
              role="option"
              aria-selected={i === active}
              id={`${id}-${i}`}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                suppressHydrationWarning
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(helper || error) && (
        <p id={`${id}-help`} className={error ? "field-error" : "helper"}>
          {error || helper}
        </p>
      )}
    </div>
  );
}
