"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { Alert, Button, Input } from "@/shared/ui";

/**
 * Shared by the dish and restaurant lists (Yelp-like browse pages): filters applied as they are
 * picked, the search bar, the filter sidebar and the two-column layout. Styles: explore.css
 * (`.explore-browse-page`, `.dish-browse`, `.dish-filter-*`).
 */

/** How a change applies: at once (chips, menus, boxes), after a pause (typed place), or on Enter. */
export type ChangeMode = "now" | "typing" | "draft";

/**
 * Filters applied as they are picked (no "Áp dụng" button). The URL keeps the applied search; our
 * own updates coming back from it do not reset what is being typed, while another search
 * (back/forward, a link) does. `problem` refuses a search that cannot match (e.g. a price range).
 */
export function useInstantFilters<F extends object>(
  applied: F,
  onApply: (filters: F) => void,
  {
    href,
    empty,
    problem: problemOf = () => "",
  }: {
    /** The search's URL, also its identity. */
    href: (filters: F) => string;
    empty: F;
    problem?: (filters: F) => string;
  },
) {
  const [draft, setDraft] = useState(applied);
  const [problem, setProblem] = useState("");
  const appliedHref = href(applied);
  const [sentHref, setSentHref] = useState(appliedHref);
  const [seenHref, setSeenHref] = useState(appliedHref);
  if (seenHref !== appliedHref) {
    setSeenHref(appliedHref);
    if (appliedHref !== sentHref) setDraft(applied);
  }
  // The newest draft for the delayed search.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function commit(next: F) {
    const refused = problemOf(next);
    if (refused) {
      setProblem(refused);
      return false;
    }
    setProblem("");
    const nextHref = href(next);
    if (nextHref !== href(applied)) {
      setSentHref(nextHref);
      onApply(next);
    }
    return true;
  }
  function change(next: Partial<F>, mode: ChangeMode) {
    const merged = { ...latest.current, ...next };
    latest.current = merged;
    setDraft(merged);
    setProblem("");
    if (timer.current) clearTimeout(timer.current);
    if (mode === "now") commit(merged);
    else if (mode === "typing")
      timer.current = setTimeout(() => commit(latest.current), 500);
  }
  /** Enter in the search box: applies the text with everything chosen. */
  function submitSearch() {
    if (timer.current) clearTimeout(timer.current);
    return commit(latest.current);
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    latest.current = empty;
    setDraft(empty);
    commit(empty);
  }
  const pristine = href(draft) === href(empty);
  return { draft, change, problem, submitSearch, reset, pristine };
}

/**
 * The search bar above the results (Enter searches). On narrow screens it also holds the button
 * that shows the filters; on wide screens they are always in the sidebar and the button is hidden.
 */
export function BrowseSearchBar({
  label,
  inputId,
  submitLabel,
  placeholder,
  value,
  onChange,
  onSubmit,
  count,
  open,
  panelId,
  onToggle,
}: {
  /** Accessible name of the search landmark and of its box ("Tìm món ăn"). */
  label: string;
  inputId: string;
  /** Name of the magnifier button ("Tìm món"). */
  submitLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Filters in use, shown on the toggle. */
  count: number;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  return (
    <form
      className="dish-search"
      role="search"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="dish-search-row">
        <div className="dish-search-box">
          <button
            type="submit"
            className="dish-search-submit"
            aria-label={submitLabel}
            title={submitLabel}
            suppressHydrationWarning
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
          </button>
          <Input
            id={inputId}
            type="search"
            aria-label={label}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="dish-filter-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          suppressHydrationWarning
        >
          <span>{open ? "Ẩn bộ lọc" : "Hiện bộ lọc"}</span>
          {count > 0 && (
            <span
              className="dish-filter-count"
              aria-label={`${count} bộ lọc đang dùng`}
            >
              {count}
            </span>
          )}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 8 5 5 5-5" />
          </svg>
        </button>
      </div>
    </form>
  );
}

/**
 * The filters. Wide screens: a sidebar flush with the left edge of the window, a "tall sticky"
 * with no scroll bar of its own (its height is measured into --sidebar-height). Narrow screens:
 * the panel the search bar's button slides down. `children` are the parts: `.dish-filter-grid`
 * fields, then `.dish-filter-groups`.
 */
export function FilterSidebar({
  label,
  open,
  panelId,
  count,
  canReset,
  onReset,
  problem,
  children,
}: {
  /** Accessible name of the sidebar ("Bộ lọc món ăn"). */
  label: string;
  open: boolean;
  panelId: string;
  count: number;
  canReset: boolean;
  onReset: () => void;
  problem: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      element.style.setProperty(
        "--sidebar-height",
        `${Math.ceil(element.offsetHeight)}px`,
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    // Not the `hidden` attribute: Tailwind's preflight forces `[hidden]` to display: none
    // !important, which would hide the sidebar on wide screens too. `data-closed` hides the
    // panel only below 1024px (explore.css).
    <div
      ref={box}
      className="dish-filter-collapse dish-filter-sidebar"
      data-closed={open ? undefined : ""}
    >
      <div>
        <aside id={panelId} className="dish-filter-panel" aria-label={label}>
          <div className="dish-filter-head">
            <h2>Bộ lọc</h2>
            {count > 0 && (
              <span className="dish-filter-count" aria-hidden>
                {count}
              </span>
            )}
            <Button
              variant="tertiary"
              className="dish-filter-reset"
              disabled={!canReset}
              onClick={onReset}
            >
              Đặt lại bộ lọc
            </Button>
          </div>
          {problem && <Alert>{problem}</Alert>}
          {children}
        </aside>
      </div>
    </div>
  );
}

/**
 * The page head: a breadcrumb "Khám phá › Quán ăn" (as on Yelp) and the description. The page
 * title stays the h1 for screen readers and the tab, without the large visible heading.
 */
export function BrowseHeading({
  title,
  section,
  description,
  banner,
}: {
  /** The h1, read by screen readers ("Khám phá quán ăn"). */
  title: string;
  /** Last breadcrumb step ("Quán ăn"). */
  section: string;
  description: string;
  /** Promotional banner shown above the breadcrumb (PlanRoadmapBanner). */
  banner?: ReactNode;
}) {
  return (
    <div className="page-title explore-browse-title">
      {banner}
      <nav className="explore-crumbs" aria-label="Đường dẫn trang">
        <ol>
          <li>Khám phá</li>
          <li aria-current="page">
            <ChevronRightIcon aria-hidden />
            {section}
          </li>
        </ol>
      </nav>
      <h1 className="sr-only">{title}</h1>
      <p className="page-description">{description}</p>
    </div>
  );
}

/**
 * Wide screens: the filter sidebar flush with the left edge, then the heading, search bar and
 * results, edge to edge. Narrow screens: heading, search bar, the filter panel, results.
 */
export function BrowseLayout({
  heading,
  search,
  sidebar,
  children,
}: {
  heading: ReactNode;
  search: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="explore-browse-page">
      <div className="dish-browse">
        <div className="dish-browse-head">{heading}</div>
        {search}
        {sidebar}
        <div className="dish-browse-main stack">{children}</div>
      </div>
    </div>
  );
}
