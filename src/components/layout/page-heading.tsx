import type { ReactNode } from "react";

/** Page title block shared by every workspace page. */
export function PageHeading({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="between page-title-row">
        <h1>{title}</h1>
        {action}
      </div>
      {description && <p className="page-description">{description}</p>}
    </div>
  );
}
