"use client";
import { useId, useState, type KeyboardEvent } from "react";
import type { RoleCode } from "@/features/auth/types";
import { HomeNearbyPanel } from "./home-nearby-panel";
import { HomeRoadmapForm } from "./home-roadmap-form";
import { useNearbyProvince } from "./use-nearby-province";

type QuickTab = "plan" | "nearby";
const tabs: readonly { value: QuickTab; label: string }[] = [
  { value: "plan", label: "Lên lịch ăn ngon" },
  { value: "nearby", label: "Ăn quanh đây" },
];

/**
 * The homepage card: plan a roadmap (RM-01) or find dishes where the visitor is now. Opening
 * "Ăn quanh đây" asks for the location right away; a found province is kept while switching.
 */
export function HomeQuickStart({ role }: { role: RoleCode | null }) {
  const id = useId();
  const [tab, setTab] = useState<QuickTab>("plan");
  const nearby = useNearbyProvince();
  function open(next: QuickTab) {
    setTab(next);
    const status = nearby.state.status;
    if (next === "nearby" && (status === "idle" || status === "error"))
      nearby.locate();
  }
  function onKeyDown(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    open(tabs[next].value);
    document.getElementById(`${id}-${tabs[next].value}`)?.focus();
  }
  return (
    <div className="home-quick-form">
      <div
        className="home-quick-tabs"
        role="tablist"
        aria-label="Bắt đầu khám phá"
      >
        {tabs.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-${item.value}`}
            aria-selected={tab === item.value}
            aria-controls={`${id}-${item.value}-panel`}
            tabIndex={tab === item.value ? 0 : -1}
            className="home-quick-tab"
            onClick={() => open(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            suppressHydrationWarning
          >
            <span aria-hidden>{item.value === "plan" ? "✦" : "➤"}</span>{" "}
            {item.label}
          </button>
        ))}
      </div>
      {/* The plan stays mounted, so typed values survive a look at the other tab. */}
      <div
        role="tabpanel"
        id={`${id}-plan-panel`}
        aria-labelledby={`${id}-plan`}
        className="home-quick-panel"
        hidden={tab !== "plan"}
      >
        <HomeRoadmapForm role={role} />
      </div>
      <div
        role="tabpanel"
        id={`${id}-nearby-panel`}
        aria-labelledby={`${id}-nearby`}
        className="home-quick-panel"
        hidden={tab !== "nearby"}
      >
        <HomeNearbyPanel state={nearby.state} onLocate={nearby.locate} />
      </div>
    </div>
  );
}
