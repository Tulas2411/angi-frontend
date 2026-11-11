"use client";
import type { ReactElement } from "react";
import type { NotificationCategory } from "./notification-rules";

/**
 * A small line icon per kind of news. They are drawn here (not loaded as images) so they
 * inherit the text colour and stay crisp at every size.
 */
const PATHS: Record<NotificationCategory, ReactElement> = {
  // A page with a pen: an article of the traveller's own.
  blog: (
    <>
      <path d="M5 3.5h8.5L18 8v12.5H5z" />
      <path d="M13 3.5V8h5" />
      <path d="M8 12h7M8 16h4" />
    </>
  ),
  // A speech bubble with a star: a comment on a rating.
  review: (
    <>
      <path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z" />
      <path d="M12 7.6l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" />
    </>
  ),
  // A route with pins: a generated itinerary.
  roadmap: (
    <>
      <path d="M4 17c4.5 0 4.5-10 9-10s3.5 10 7 10" />
      <circle cx="4" cy="17" r="1.8" />
      <circle cx="20" cy="17" r="1.8" />
      <path d="M13 7V4.5h4" />
    </>
  ),
  // A bowl with steam: a dish of the restaurant's menu.
  menu: (
    <>
      <path d="M3.5 10.5h17a8.5 8.5 0 0 1-8.5 8 8.5 8.5 0 0 1-8.5-8z" />
      <path d="M2.5 21h19" />
      <path d="M9 7c0-1.2 1.4-1.4 1.4-2.6M13 7c0-1.2 1.4-1.4 1.4-2.6" />
    </>
  ),
  // A shield with a tick: a verified restaurant.
  verification: (
    <>
      <path d="M12 3l7 2.6v5.6c0 4.2-2.9 7.4-7 8.8-4.1-1.4-7-4.6-7-8.8V5.6z" />
      <path d="M8.8 11.8l2.2 2.2 4.2-4.4" />
    </>
  ),
  // A flag: a resolved report.
  report: (
    <>
      <path d="M6 21V3.5" />
      <path d="M6 4.5h11l-2 3.5 2 3.5H6z" />
    </>
  ),
  // A person: something about the account itself.
  account: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
    </>
  ),
  // A bell: anything else.
  general: (
    <>
      <path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2.2H5z" />
      <path d="M10 20.2a2.2 2.2 0 0 0 4 0" />
    </>
  ),
};

/** The round icon that opens a notification row. */
export function NotificationGlyph({
  category,
  className = "",
}: {
  category: NotificationCategory;
  className?: string;
}) {
  return (
    <span className={`notification-glyph ${className}`.trim()} aria-hidden>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[category]}
      </svg>
    </span>
  );
}
