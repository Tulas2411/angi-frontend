import type { ReactNode } from "react";
import { Alert, Button } from "@/shared/ui";
import { getErrorMessage } from "@/shared/api/error";

/** Title row of a blog screen: the noun, one grey line about the data, the real actions on the right. */
export function BlogHeading({
  title,
  line,
  actions,
}: {
  title: string;
  line?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="blog-heading">
      <div>
        <h1>{title}</h1>
        {line && <p className="blog-line">{line}</p>}
      </div>
      {actions && <div className="blog-heading-actions">{actions}</div>}
    </header>
  );
}

/** Loading: the final layout as flat grey bars at their real size, no shimmer, no shift. */
export function BlogSkeleton({
  rows = 4,
  lead = false,
}: {
  rows?: number;
  lead?: boolean;
}) {
  return (
    <div role="status" aria-label="Đang tải" className="blog-skeleton">
      {lead && <div className="blog-skeleton-lead" />}
      <div className="blog-skeleton-rows">
        {Array.from({ length: rows }, (_, index) => (
          <div className="blog-skeleton-row" key={index} />
        ))}
      </div>
      <span className="sr-only">Đang tải nội dung…</span>
    </div>
  );
}

/** A failed block says what failed and offers one retry; it never takes over the screen. */
export function BlogProblem({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <section className="blog-panel stack-sm" aria-label={title}>
      <h2>{title}</h2>
      <Alert>{getErrorMessage(error)}</Alert>
      <div>
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    </section>
  );
}
