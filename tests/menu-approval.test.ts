import { afterEach, describe, expect, it, vi } from "vitest";
import {
  menuApprovalIssue,
  menuApprovalRequest,
  validateMenuOwnerNote,
} from "@/features/owner/menu-approval-rules";
import { restaurantMenuService } from "@/features/owner/menu-service";
import { ownerMenuOperation } from "@/shared/api/owner-menu-proxy";
import { menuDetailSample, ownerMenuSample } from "./fixtures/restaurant-menu";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("F-51 OWN-17", () => {
  it("uses the exact POST, optional note and 200 metadata DTO without inventing items or a new submission", async () => {
    const { items, removedDishes, ...metadata } = menuDetailSample;
    void items;
    void removedDishes;
    const result = {
      ...metadata,
      status: "pending",
      submittedAt: "2026-10-17T01:00:00Z",
      ownerNote: "Tăng giá món",
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          errorCode: null,
          message: null,
          data: result,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    expect(
      await restaurantMenuService.submit(
        14,
        menuApprovalRequest("  Tăng giá món  "),
      ),
    ).toEqual(result);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      "/api/backend/owner/restaurant/menu-submissions/14/submit",
    );
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ ownerNote: "Tăng giá món" });
    expect(
      ownerMenuOperation("POST", "owner/restaurant/menu-submissions/14/submit"),
    ).toEqual({ body: true, status: 200 });
    for (const method of ["GET", "PUT", "PATCH", "DELETE"])
      expect(
        ownerMenuOperation(
          method,
          "owner/restaurant/menu-submissions/14/submit",
        ),
      ).toBeNull();
    for (const id of ["0", "-1", "1.5", "abc", "01"])
      expect(
        ownerMenuOperation(
          "POST",
          `owner/restaurant/menu-submissions/${id}/submit`,
        ),
      ).toBeNull();
    expect(
      ownerMenuOperation(
        "POST",
        "owner/restaurant/menu-submissions/14/submit/extra",
      ),
    ).toBeNull();
  });
  it("omits a blank optional note and applies the backend's untrimmed 1000-character limit", () => {
    expect(menuApprovalRequest("  \n ")).toEqual({});
    expect(validateMenuOwnerNote("")).toBeUndefined();
    expect(validateMenuOwnerNote("x".repeat(1000))).toBeUndefined();
    expect(validateMenuOwnerNote("x".repeat(1001))).toBeTruthy();
    expect(validateMenuOwnerNote(" ".repeat(1001))).toBeTruthy();
  });
  it("recognizes removals as changes and prevents empty/unchanged submission without counting availability", () => {
    expect(menuApprovalIssue(menuDetailSample)).toBe("MENU_UNCHANGED");
    expect(
      menuApprovalIssue({
        ...menuDetailSample,
        items: [],
        removedDishes: ownerMenuSample.dishes,
      }),
    ).toBe("MENU_EMPTY");
    expect(
      menuApprovalIssue({
        ...menuDetailSample,
        removedDishes: ownerMenuSample.dishes,
      }),
    ).toBeNull();
    for (const change of ["new", "edited"] as const)
      expect(
        menuApprovalIssue({
          ...menuDetailSample,
          items: [{ ...menuDetailSample.items[0], change }],
        }),
      ).toBeNull();
  });
});
