import { proposalItems } from "./agent-rules";
import {
  roadmapMapCoordinate,
  type RoadmapMapCoordinate,
} from "./roadmap-map-rules";
import type { AgentItem, AgentProposal } from "./agent-types";

export interface AgentMapStop {
  item: AgentItem;
  dayNumber: number;
  number: number;
  coordinate: RoadmapMapCoordinate | null;
  changed: boolean;
}

/** What the roadmap map draws while the assistant shows a preview: the preview replaces the saved stops. */
export interface AgentMapPreview {
  stops: AgentMapStop[];
  days: number[];
  activeDay: number;
  selectedKey: string;
  onSelect: (itemKey: string) => void;
}

export const agentDishName = (item: AgentItem) =>
  item.dishName ?? "Món chưa có tên";

/** Items the preview adds or replaces. Retained, moved and removed rows are not new dishes. */
export function agentChangedItemKeys(proposal: AgentProposal) {
  const keys = new Set<string>();
  for (const change of proposal.snapshot.changes ?? []) {
    if (change.type !== "add" && change.type !== "replace") continue;
    const key = change.item?.itemKey ?? change.targetItemKey;
    if (key) keys.add(key);
  }
  return keys;
}

/** Stop numbers restart each day and follow the preview's order, including items without coordinates. */
export function agentMapStops(proposal: AgentProposal): AgentMapStop[] {
  const changed = agentChangedItemKeys(proposal);
  const counts = new Map<number, number>();
  return proposalItems(proposal).map((item) => {
    const number = (counts.get(item.dayNumber) ?? 0) + 1;
    counts.set(item.dayNumber, number);
    return {
      item,
      dayNumber: item.dayNumber,
      number,
      coordinate: roadmapMapCoordinate(item.latitude, item.longitude),
      changed: changed.has(item.itemKey),
    };
  });
}

/** Every planned day, so an empty day stays reachable; a preview may hold more days than the saved roadmap. */
export function agentMapDays(proposal: AgentProposal) {
  const days = new Set(proposal.snapshot.items.map((item) => item.dayNumber));
  for (let day = 1; day <= (proposal.snapshot.state.numDays ?? 0); day++)
    days.add(day);
  return [...days].sort((a, b) => a - b);
}

/** Opens a new preview on the first day it changes, so the highlighted dishes are in view. */
export function agentDefaultDay(proposal: AgentProposal) {
  return (
    agentMapStops(proposal).find((stop) => stop.changed)?.dayNumber ??
    agentMapDays(proposal)[0] ??
    1
  );
}
