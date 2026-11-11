"use client";
import { useEffect, useRef, useState } from "react";
import {
  ratingButtonLabel,
  ratingLabels,
  type RatingValue,
} from "./roadmap-rate-rules";
import type { RoadmapItemDto } from "./roadmap-types";

/** Thumbs of the two buttons, drawn inline so they follow the text colour. */
function Thumb({ value }: { value: RatingValue }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={value === "dislike" ? { transform: "scaleY(-1)" } : undefined}
    >
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4-7a2 2 0 0 1 2 2v4h5.6a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.4 20H7" />
    </svg>
  );
}

/**
 * F-30: the like and dislike buttons at the bottom right of a dish (RM-13). A press saves the
 * rating at once; a dish is rated once and the rating can never be changed or removed afterwards.
 * `onRate` saves it and says what went wrong itself (a notice in the day), so nothing is thrown.
 */
export function RateItemButtons({
  item,
  onRate,
}: {
  item: RoadmapItemDto;
  onRate: (value: RatingValue) => Promise<void>;
}) {
  const { dish } = item;
  const rated = item.myFeedback;
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function rate(value: RatingValue) {
    if (rated !== null || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await onRate(value);
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div
      className="roadmap-item-rate"
      role="group"
      aria-label={`Đánh giá ${dish.name}`}
      aria-busy={busy || undefined}
    >
      {(["like", "dislike"] as const).map((value) => {
        const chosen = rated === value;
        return (
          <button
            key={value}
            type="button"
            className="roadmap-rate-button"
            data-value={value}
            aria-pressed={chosen}
            aria-disabled={rated !== null || busy || undefined}
            aria-label={ratingButtonLabel(value, dish.name, rated)}
            title={
              rated === null
                ? `${ratingLabels[value].action}: mỗi món chỉ đánh giá một lần`
                : chosen
                  ? "Đánh giá này không đổi được"
                  : "Món này đã được đánh giá"
            }
            onClick={() => void rate(value)}
            suppressHydrationWarning
          >
            <Thumb value={value} />
            <span>{ratingLabels[value].action}</span>
          </button>
        );
      })}
    </div>
  );
}
