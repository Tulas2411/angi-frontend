import { describe, expect, it } from "vitest";
import { initialData } from "@/mocks/fixtures";
import {
  createDemoService,
  liveService,
  UnavailableContractError,
} from "@/api/services/data-service";
import {
  effectivePermission,
  pageSlice,
  retrySyncEvent,
  serializeOverrides,
  snapshotTrip,
  tripDates,
  validateDateRange,
  validateUpload,
} from "@/features/platform/rules";

describe("platform business boundaries", () => {
  it("sends only grantable allow/deny overrides and an empty list restores inheritance", () => {
    const permissions = initialData.permissions;
    expect(
      serializeOverrides(
        {
          "user.ban": "deny",
          "admin.audit": "allow",
          "dashboard.view": "inherit",
          unknown: "allow",
        },
        permissions,
      ),
    ).toEqual([{ permission: "user.ban", effect: "deny" }]);
    expect(
      serializeOverrides(
        Object.fromEntries(permissions.map((p) => [p.code, "inherit"])),
        permissions,
      ),
    ).toEqual([]);
    expect(
      effectivePermission(
        permissions.find((p) => p.code === "user.ban")!,
        "inherit",
      ),
    ).toBe(true);
    expect(
      effectivePermission(
        permissions.find((p) => p.code === "user.ban")!,
        "deny",
      ),
    ).toBe(false);
    expect(
      effectivePermission(
        permissions.find((p) => p.code === "admin.audit")!,
        "allow",
      ),
    ).toBe(false);
  });
  it("queues exactly one dead event without claiming completed synchronization", () => {
    const original = structuredClone(initialData.sync),
      next = retrySyncEvent(original[0]);
    expect(next.status).toBe("pending");
    expect(next.attempts).toBe(original[0].attempts);
    expect(original.every((e) => e.status === "dead")).toBe(true);
    expect(() => retrySyncEvent(next)).toThrow("Chỉ thử lại");
  });
  it("validates real dates and enumerates inclusive ranges across months", () => {
    expect(validateDateRange("2026-10-09", "2026-10-08")).toBeTruthy();
    expect(validateDateRange("2026-02-30", "2026-03-02")).toBeTruthy();
    expect(tripDates("2026-09-30", "2026-10-02")).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(tripDates("", "")).toEqual([]);
  });
  it("enforces separate image and document size/type limits", () => {
    expect(
      validateUpload({ type: "image/png", size: 5 * 1024 * 1024 }),
    ).toBeNull();
    expect(
      validateUpload({ type: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ).toBeTruthy();
    expect(
      validateUpload({ type: "application/pdf", size: 10 * 1024 * 1024 }, true),
    ).toBeNull();
    expect(
      validateUpload(
        { type: "application/pdf", size: 10 * 1024 * 1024 + 1 },
        true,
      ),
    ).toBeTruthy();
    expect(validateUpload({ type: "application/pdf", size: 1 })).toBeTruthy();
    expect(validateUpload({ type: "image/svg+xml", size: 1 })).toBeTruthy();
  });
  it("keeps an attached itinerary independent from later menu and trip edits", () => {
    const data = structuredClone(initialData),
      snapshot = snapshotTrip(data.trips[0], data),
      item = snapshot.days[0].items[0];
    const originalPrice = item.snapshot!.price;
    data.dishes.find((d) => d.id === item.dishId)!.price = 999999;
    data.trips[0].days[0].items = [];
    expect(snapshot.days[0].items.length).toBe(4);
    expect(item.snapshot!.price).toBe(originalPrice);
    expect(snapshot.readOnly).toBe(true);
  });
  it("keeps page bounds, totals and empty results consistent", () => {
    expect(pageSlice([1, 2, 3, 4, 5, 6], 999, 5)).toMatchObject({
      items: [6],
      page: 2,
      total: 6,
      first: 6,
      last: 6,
      pages: 2,
    });
    expect(pageSlice([], 3)).toMatchObject({
      items: [],
      first: 0,
      last: 0,
      page: 1,
    });
  });
});
describe("replaceable service", () => {
  it("isolates fixtures, service state and consumer reads", async () => {
    const a = createDemoService(),
      b = createDemoService(),
      data = await a.load();
    data.restaurants[0].moderation = "hidden";
    await a.save(data);
    data.restaurants[0].moderation = "suspended";
    expect((await a.load()).restaurants[0].moderation).toBe("hidden");
    expect((await b.load()).restaurants[0].moderation).toBe("visible");
    expect(initialData.restaurants[0].moderation).toBe("visible");
  });
  it("keeps live operations unavailable instead of fabricating endpoints", async () => {
    await expect(liveService.load()).rejects.toBeInstanceOf(
      UnavailableContractError,
    );
    await expect(liveService.save(initialData)).rejects.toBeInstanceOf(
      UnavailableContractError,
    );
  });
  it("has coherent dish-to-restaurant references and distinct restaurant statuses", () => {
    for (const trip of initialData.trips)
      for (const day of trip.days)
        for (const item of day.items) {
          expect(
            initialData.dishes.find((d) => d.id === item.dishId)?.restaurantId,
          ).toBe(item.restaurantId);
          expect(
            initialData.restaurants.some((r) => r.id === item.restaurantId),
          ).toBe(true);
        }
  });
});
