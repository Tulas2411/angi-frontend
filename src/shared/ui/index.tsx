import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
export type ButtonVariant =
  "primary" | "secondary" | "tertiary" | "destructive" | "icon";
export function Button({
  className = "",
  variant = "primary",
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`button button-${variant} ${className}`.trim()}
      // Browser extensions (McAfee Web Advisor, password managers) inject
      // `fdprocessedid` onto <button> before React hydrates, which triggers a
      // hydration mismatch. suppressHydrationWarning only silences this
      // element's own attributes; it never hides real content mismatches.
      suppressHydrationWarning
    >
      {loading && <span className="spinner" aria-hidden />}
      {loading ? "Đang xử lý…" : children}
    </button>
  );
}
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`input ${className}`.trim()}
      // See the note on Button: extensions may add `fdprocessedid` to
      // <input> before hydration.
      suppressHydrationWarning
    />
  );
}
export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`.trim()}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "warning" | "success" | "info";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`alert alert-${tone}`}
    >
      <span className="alert-symbol" aria-hidden>
        {tone === "error" ? "!" : tone === "success" ? "✓" : "i"}
      </span>
      <div>{children}</div>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "error" | "warning";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
