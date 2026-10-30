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
import { pageSlice, validateUpload } from "@/features/platform/rules";
import { searchText } from "@/shared/text/search";

export function Icon({
  name,
}: {
  name:
    | "search"
    | "bell"
    | "calendar"
    | "warning"
    | "success"
    | "motorcycle"
    | "Plus"
    | "Minus"
    | "X"
    | "edit"
    | "trash"
    | "LocateFixed"
    | "connection"
    | "roadmap-chevron";
}) {
  return (
    <span className={`icon icon-${name}`} aria-hidden>
      <img src={`/assets/figma/${name}.svg`} alt="" />
    </span>
  );
}
export function Breadcrumbs({
  items,
}: {
  items: readonly { label: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Đường dẫn trang">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
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
export function CardActionLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: "edit" | "trash";
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`card-action card-action-${icon}`}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </Link>
  );
}
export function CardActionButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: "edit" | "trash";
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-action card-action-${icon}`}
      aria-label={label}
      title={label}
      suppressHydrationWarning
    >
      <Icon name={icon} />
    </button>
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
  danger = false,
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
  /** Nút xác nhận đỏ đặc cho hành động không thể hoàn tác. */
  danger?: boolean;
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
            variant={
              danger ? "danger" : destructive ? "destructive" : "primary"
            }
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
export function Pagination({
  total,
  page,
  size = 5,
  onChange,
}: {
  total: number;
  page: number;
  size?: number;
  onChange: (value: number) => void;
}) {
  const {
    first,
    last,
    pages,
    page: current,
  } = pageSlice(Array.from({ length: total }), page, size);
  return (
    <div className="pagination">
      <span className="helper">
        {first}–{last} trên {total} mục · Trang {current} / {pages}
      </span>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          Trang trước
        </Button>
        <Button
          variant="secondary"
          disabled={current >= pages}
          onClick={() => onChange(current + 1)}
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  caption,
  page = 1,
  onPage,
  size = 5,
}: {
  rows: T[];
  columns: { label: string; render: (row: T) => ReactNode }[];
  caption: string;
  page?: number;
  onPage?: (value: number) => void;
  size?: number;
}) {
  const shown = onPage ? pageSlice(rows, page, size).items : rows;
  return (
    <>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table style={{ minWidth: Math.max(420, columns.length * 150) }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.label} scope="col">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.label}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <EmptyState title="Không có kết quả">
          Thử thay đổi bộ lọc hoặc từ khóa.
        </EmptyState>
      )}
      {onPage && (
        <Pagination
          total={rows.length}
          page={page}
          size={size}
          onChange={onPage}
        />
      )}
    </>
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
export interface UploadedFile {
  id: string;
  name: string;
  url?: string;
  size: number;
  type: string;
}
export function UploadField({
  label,
  files,
  onChange,
  documents = false,
  max = 1,
  helper,
  showCount = true,
  actionLabel,
}: {
  label: string;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  documents?: boolean;
  max?: number;
  /** Ghi đè dòng mô tả định dạng tệp mặc định. */
  helper?: string;
  /** Ẩn bộ đếm "x / max" khi nhãn đã chứa thông tin tương đương. */
  showCount?: boolean;
  /** Nhãn của ô bấm để chọn tệp (mặc định "Chọn ảnh" / "Chọn tài liệu"). */
  actionLabel?: string;
}) {
  const [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [pending, setPending] = useState<File[]>([]),
    input = useRef<HTMLInputElement>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    id = useId();
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  function upload(picked: File[]) {
    if (files.length + picked.length > max) {
      setError(`Tối đa ${max} tệp. Bỏ tệp cũ trước khi chọn tệp mới.`);
      return;
    }
    const problem = picked
      .map((f) => validateUpload(f, documents))
      .find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setPending(picked);
    setProgress(1);
    let value = 1;
    timer.current = setInterval(async () => {
      value += 33;
      setProgress(Math.min(100, value));
      if (value >= 100) {
        if (timer.current) clearInterval(timer.current);
        try {
          const next = await Promise.all(
            picked.map(async (file) => {
              const url = file.type.startsWith("image/")
                ? await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () =>
                      reject(new Error("Không đọc được tệp."));
                    reader.readAsDataURL(file);
                  })
                : undefined;
              return {
                id: crypto.randomUUID(),
                name: file.name,
                url,
                size: file.size,
                type: file.type,
              };
            }),
          );
          onChange([...files, ...next]);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Không đọc được tệp. Chọn lại để thử.",
          );
        } finally {
          setProgress(0);
          setPending([]);
        }
      }
    }, 140);
  }
  return (
    <div className="upload-field">
      <div className="between">
        <label htmlFor={id}>{label}</label>
        {showCount && (
          <span className="helper">
            {files.length} / {max}
          </span>
        )}
      </div>
      <p className="helper">
        {helper ??
          `JPG, PNG, WEBP tối đa 5 MB${documents ? "; PDF tối đa 10 MB" : ""}. Tải tệp trong bản minh họa.`}
      </p>
      <input
        id={id}
        ref={input}
        type="file"
        className="sr-only"
        accept={
          documents
            ? "image/jpeg,image/png,image/webp,application/pdf"
            : "image/jpeg,image/png,image/webp"
        }
        multiple={max > 1}
        disabled={progress > 0}
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        suppressHydrationWarning
      />
      <div className="upload-grid">
        {files.map((file) => (
          <div className="upload-tile" key={file.id}>
            {file.url ? (
              <Media src={file.url} alt={file.name} />
            ) : (
              <div className="file-preview">PDF</div>
            )}
            <Button
              variant="icon"
              aria-label={`Bỏ ${file.name}`}
              onClick={() => onChange(files.filter((f) => f.id !== file.id))}
            >
              <Icon name="trash" />
            </Button>
            <p>{file.name}</p>
            <span className="helper">
              {(file.size / 1024 / 1024).toFixed(1)} MB · Đã chọn
            </span>
          </div>
        ))}
        {files.length < max && (
          <button
            className="upload-drop"
            type="button"
            onClick={() => input.current?.click()}
            disabled={progress > 0}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!progress) upload(Array.from(e.dataTransfer.files));
            }}
            suppressHydrationWarning
          >
            <span aria-hidden>＋</span>
            {actionLabel ?? `Chọn ${documents ? "tài liệu" : "ảnh"}`}
          </button>
        )}
      </div>
      {progress > 0 && (
        <div role="status">
          <label>
            Tải {pending.length} tệp: {progress}%
            <progress value={progress} max={100} />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}{" "}
          <Button variant="tertiary" onClick={() => input.current?.click()}>
            Chọn lại
          </Button>
        </p>
      )}
    </div>
  );
}
export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <span className="tooltip" tabIndex={0} aria-describedby={id}>
      {children}
      <span role="tooltip" id={id}>
        {text}
      </span>
    </span>
  );
}
