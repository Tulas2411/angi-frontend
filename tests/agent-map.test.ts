import { describe, expect, it } from "vitest";
import {
  agentChangedItemKeys,
  agentDefaultDay,
  agentDishName,
  agentMapDays,
  agentMapStops,
} from "@/features/roadmaps/agent-map-rules";
import { standaloneValidation } from "@/features/roadmaps/agent-rules";
import { groupRoadmapStops } from "@/features/roadmaps/roadmap-map-rules";
import type { AgentItem, AgentProposal } from "@/features/roadmaps/agent-types";
import { agentProposal, agentState } from "./fixtures/agent";

function item(
  itemKey: string,
  dayNumber: number,
  mealSlot: AgentItem["mealSlot"],
  patch: Partial<AgentItem> = {},
): AgentItem {
  return {
    itemKey,
    sourceItemId: null,
    dayNumber,
    mealSlot,
    sortOrder: 0,
    dishId: 1,
    requestId: null,
    price: 50000,
    dishName: `Món ${itemKey}`,
    restaurantName: "Quán A",
    latitude: 16.05,
    longitude: 108.2,
    ...patch,
  };
}

function preview(
  items: AgentItem[],
  changes: AgentProposal["snapshot"]["changes"] = [],
  numDays = 2,
): AgentProposal {
  const base = agentProposal();
  return {
    ...base,
    snapshot: {
      ...base.snapshot,
      state: { ...agentState(), numDays },
      items,
      changes,
    },
  };
}

describe("agent preview map rules", () => {
  it("numbers stops per day in meal order, keeping items without coordinates", () => {
    const stops = agentMapStops(
      preview([
        item("dinner", 1, "dinner"),
        item("lunch", 1, "lunch", { latitude: null }),
        item("breakfast2", 2, "breakfast"),
      ]),
    );

    expect(
      stops.map((stop) => [stop.item.itemKey, stop.dayNumber, stop.number]),
    ).toEqual([
      ["lunch", 1, 1],
      ["dinner", 1, 2],
      ["breakfast2", 2, 1],
    ]);
    expect(stops[0].coordinate).toBeNull();
    expect(stops[1].coordinate).toEqual({ latitude: 16.05, longitude: 108.2 });
  });

  it("rejects coordinates outside the valid range instead of drawing them", () => {
    const [stop] = agentMapStops(
      preview([item("a", 1, "lunch", { latitude: 91 })]),
    );

    expect(stop.coordinate).toBeNull();
  });

  it("marks only added and replaced dishes as changed", () => {
    const added = item("added", 1, "lunch");
    const replaced = item("replaced", 1, "dinner");
    const moved = item("moved", 2, "lunch");
    const proposal = preview(
      [added, replaced, moved, item("kept", 2, "dinner")],
      [
        { type: "add", targetItemKey: null, item: added },
        { type: "replace", targetItemKey: "replaced", item: replaced },
        { type: "move", targetItemKey: "moved", item: moved },
        { type: "remove", targetItemKey: "gone", item: null },
      ],
    );

    expect([...agentChangedItemKeys(proposal)].sort()).toEqual([
      "added",
      "replaced",
    ]);
    expect(
      agentMapStops(proposal)
        .filter((stop) => stop.changed)
        .map((stop) => stop.item.itemKey)
        .sort(),
    ).toEqual(["added", "replaced"]);
  });

  it("falls back to the target key and tolerates a preview without changes", () => {
    expect([
      ...agentChangedItemKeys(
        preview([], [{ type: "replace", targetItemKey: "target", item: null }]),
      ),
    ]).toEqual(["target"]);
    expect(agentChangedItemKeys(preview([], null)).size).toBe(0);
  });

  it("lists every planned day even when one is empty, beyond the saved day count", () => {
    expect(agentMapDays(preview([item("a", 2, "lunch")], [], 3))).toEqual([
      1, 2, 3,
    ]);
    expect(agentMapDays(preview([item("a", 4, "lunch")], [], 1))).toEqual([
      1, 4,
    ]);
  });

  it("opens on the first changed day, else the first day", () => {
    const changed = item("changed", 3, "lunch");
    expect(
      agentDefaultDay(
        preview(
          [item("a", 1, "lunch"), changed],
          [{ type: "add", targetItemKey: null, item: changed }],
          3,
        ),
      ),
    ).toBe(3);
    expect(agentDefaultDay(preview([item("a", 2, "lunch")], [], 2))).toBe(1);
    expect(agentDefaultDay(preview([], [], 0))).toBe(1);
  });

  it("groups dishes of one restaurant into a single pin", () => {
    const groups = groupRoadmapStops(
      agentMapStops(
        preview([
          item("a", 1, "lunch"),
          item("b", 1, "dinner"),
          item("c", 2, "lunch", { latitude: 16.06 }),
          item("d", 2, "dinner", { latitude: null }),
        ]),
      ),
    );

    expect(
      groups.map((group) => group.stops.map((stop) => stop.item.itemKey)),
    ).toEqual([["a", "b"], ["c"]]);
  });

  it("names a dish without a name in plain words, never by its ID", () => {
    expect(agentDishName(item("a", 1, "lunch", { dishName: null }))).toBe(
      "Món chưa có tên",
    );
  });
});

describe("standaloneValidation", () => {
  const validation = (errors: string[], warnings: string[]) => ({
    errors,
    warnings,
    totalCost: 1,
    routes: [],
  });

  it("drops notices the proposal card already shows", () => {
    const proposal = agentProposal({
      validation: validation(["Lỗi A"], ["Cảnh báo A"]),
    });

    expect(
      standaloneValidation(validation(["Lỗi A"], ["Cảnh báo A"]), proposal),
    ).toBeNull();
    expect(
      standaloneValidation(validation(["Lỗi A", "Lỗi B"], []), proposal),
    ).toMatchObject({ errors: ["Lỗi B"], warnings: [] });
  });

  it("keeps everything when no card is shown, and passes null through", () => {
    const value = validation(["Lỗi A"], []);

    expect(standaloneValidation(value, null)).toBe(value);
    expect(standaloneValidation(value, undefined)).toBe(value);
    expect(standaloneValidation(null, agentProposal())).toBeNull();
  });
});
