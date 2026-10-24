import { afterEach, describe, expect, it, vi } from "vitest";
import {
  menuApprovalIssue,
  menuApprovalRequest,
  validateMenuOwnerNote,
} from "@/features/owner/menu-approval-rules";
import { restaurantMenuService } from "@/features/owner/menu-service";
import { ownerMenuOperation } from "@/shared/api/owner-menu-proxy";
import { ApiError } from "@/shared/api/error";
import { initialData } from "@/mocks/fixtures";
import { createMockRestaurantMenuService } from "@/mocks/restaurant-menu";
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
  it("demo enforces empty/unchanged/draft-only states and pending metadata, preserving the active menu", async () => {
    const service = createMockRestaurantMenuService(
      structuredClone(initialData),
      async () => {},
    );
    const current = await service.getMenu(),
      draft = await service.create();
    await expect(service.submit(draft.id, {})).rejects.toMatchObject({
      status: 400,
      errorCode: "MENU_UNCHANGED",
    });
    await service.update(draft.id, draft.items[0].id, {
      price: draft.items[0].price + 1,
    });
    await expect(
      service.submit(draft.id, { ownerNote: "x".repeat(1001) }),
    ).rejects.toMatchObject({
      status: 400,
      errorCode: "VALIDATION_FAILED",
      errors: { OwnerNote: expect.any(Array) },
    });
    const submitted = await service.submit(draft.id, {
      ownerNote: "  Đã sửa giá  ",
    });
    expect(submitted).toMatchObject({
      id: draft.id,
      status: "pending",
      ownerNote: "Đã sửa giá",
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    });
    expect(submitted.submittedAt).not.toBeNull();
    expect(submitted).not.toHaveProperty("items");
    expect((await service.getMenu()).dishes).toEqual(current.dishes);
    expect((await service.getMenu()).openSubmission).toEqual({
      id: draft.id,
      status: "pending",
    });
    await expect(service.submit(draft.id, {})).rejects.toMatchObject({
      status: 409,
      errorCode: "SUBMISSION_NOT_EDITABLE",
    });
    await expect(
      service.update(draft.id, draft.items[0].id, { price: 1 }),
    ).rejects.toMatchObject({ errorCode: "SUBMISSION_NOT_EDITABLE" });
    await service.cancel(draft.id);
    const empty = await service.create();
    for (const item of empty.items) await service.remove(empty.id, item.id);
    await expect(service.submit(empty.id, {})).rejects.toMatchObject({
      status: 400,
      errorCode: "MENU_EMPTY",
    });
    await expect(service.submit(999999, {})).rejects.toBeInstanceOf(ApiError);
  });
});
