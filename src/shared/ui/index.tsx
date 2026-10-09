import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-orange-600 text-white hover:bg-orange-700"
          : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
        className,
      ].join(" ")}
    />
  );
}
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-stone-50",
        className,
      ].join(" ")}
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
    <section
      className={[
        "rounded-2xl border border-stone-200 bg-white p-6 shadow-sm",
        className,
      ].join(" ")}
    >
      {title && <h2 className="mb-5 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
    >
      {children}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
      {children}
    </span>
  );
}
