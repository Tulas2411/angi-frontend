import { afterEach, describe, expect, it, vi } from "vitest";
import { restaurantMenuService as service } from "@/features/owner/menu-service";
import {
  menuFieldErrors,
  menuItemRequest,
  menuItemValues,
  newMenuItemRequest,
  openMenuId,
  validateMenuItem,
} from "@/features/owner/menu-rules";
import { ownerMenuOperation } from "@/shared/api/owner-menu-proxy";
import { ApiError } from "@/shared/api/error";
import { menuDetailSample } from "./fixtures/restaurant-menu";
import { createMockRestaurantMenuService } from "@/mocks/restaurant-menu";
import { initialData } from "@/mocks/fixtures";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("F-50 contracts", () => {
  it("uses all nine methods, paginated query, no-body commands and successful null DELETE", async () => {
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: null,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    await service.getMenu();
    await service.availability(105, false);
    await service.create();
    await service.history(2, 5, "rejected");
    await service.detail(14);
    const body = newMenuItemRequest({
      ...menuItemValues(menuDetailSample.items[0]),
      sortOrder: "",
    });
    await service.add(14, body);
    await service.update(14, 340, { coverMediaId: null, tagIds: [] });
    expect(await service.remove(14, 340)).toBeNull();
    await service.cancel(14);
    expect(
      fetch.mock.calls.map(([path, options]) => [
        String(path).replace(/^.*\/backend\//, ""),
        options.method ?? "GET",
      ]),
    ).toEqual([
      ["owner/restaurant/menu", "GET"],
      ["owner/restaurant/menu/dishes/105/availability", "PUT"],
      ["owner/restaurant/menu-submissions", "POST"],
      [
        "owner/restaurant/menu-submissions?page=2&pageSize=5&status=rejected",
        "GET",
      ],
      ["owner/restaurant/menu-submissions/14", "GET"],
      ["owner/restaurant/menu-submissions/14/items", "POST"],
      ["owner/restaurant/menu-submissions/14/items/340", "PATCH"],
      ["owner/restaurant/menu-submissions/14/items/340", "DELETE"],
      ["owner/restaurant/menu-submissions/14/cancel", "POST"],
    ]);
    for (const index of [2, 7, 8])
      expect(fetch.mock.calls[index][1].body).toBeUndefined();
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      isAvailable: false,
    });
    expect(JSON.parse(fetch.mock.calls[6][1].body)).toEqual({
      coverMediaId: null,
      tagIds: [],
    });
  });
  it("uploads dish-purpose multipart and preserves field errors/open-submission data", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { id: 9100 },
            message: null,
            errorCode: null,
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            data: { id: 14 },
            errorCode: "SUBMISSION_ALREADY_OPEN",
            message: null,
            errors: { Price: ["Giá không hợp lệ"] },
          }),
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await service.upload(
      new File(["image"], "dish.png", { type: "image/png" }),
    );
    expect(fetch.mock.calls[0][1].body.get("purpose")).toBe("dish");
    try {
      await service.create();
      throw new Error("expected conflict");
    } catch (error) {
      expect(openMenuId(error)).toBe(14);
      expect(menuFieldErrors(error)).toEqual({ price: "Giá không hợp lệ" });
    }
    expect(
      openMenuId(
        new ApiError(409, "SUBMISSION_ALREADY_OPEN", "", undefined, {
          id: "14",
        }),
      ),
    ).toBeNull();
  });
  it("restricts the proxy to exact positive-ID operations and preserves 201/200/body policy", () => {
    const base = "owner/restaurant/menu-submissions";
    expect(ownerMenuOperation("POST", base)).toEqual({
      body: false,
      status: 201,
    });
    expect(ownerMenuOperation("POST", `${base}/14/cancel`)).toEqual({
      body: false,
      status: 200,
    });
    expect(ownerMenuOperation("DELETE", `${base}/14/items/340`)).toEqual({
      body: false,
      status: 200,
    });
    expect(ownerMenuOperation("POST", `${base}/14/items`)).toEqual({
      body: true,
      status: 201,
    });
    for (const path of [
      `${base}/0`,
      `${base}/-1`,
      `${base}/1/submit`,
      `${base}/1/items/0`,
      `${base}/1/items/2/extra`,
      `${base}/1/approve`,
    ])
      for (const method of ["GET", "POST", "PATCH", "DELETE"])
        expect(ownerMenuOperation(method, path)).toBeNull();
  });
});
describe("menu editor", () => {
  it("demo retains real fixture images with explicit media IDs, can clear them and restores unchanged markers", async () => {
    const mock = createMockRestaurantMenuService(
      structuredClone(initialData),
      async () => {},
    );
    const current = await mock.getMenu(),
      draft = await mock.create(),
      item = draft.items[0];
    expect(item.coverMediaId).toBeGreaterThan(0);
    expect(
      (await mock.update(draft.id, item.id, { coverMediaId: null })).coverUrl,
    ).toBeNull();
    expect((await mock.getMenu()).dishes[0].coverUrl).toBe(
      current.dishes[0].coverUrl,
    );
    expect(
      (
        await mock.update(draft.id, item.id, {
          coverMediaId: item.coverMediaId,
        })
      ).change,
    ).toBe("unchanged");
    await mock.cancel(draft.id);
    expect((await mock.getMenu()).openSubmission).toBeNull();
  });
  it("omits unchanged fields and retains legacy nullable/short descriptions and unknown tag IDs", () => {
    const item = {
      ...menuDetailSample.items[0],
      description: null,
      coverMediaId: 9100,
      coverUrl: "https://example.invalid/image",
      tagIds: [2, 999],
    };
    const values = menuItemValues(item);
    expect(menuItemRequest(values, item)).toEqual({});
    expect(validateMenuItem(values, item)).toEqual({});
    expect(menuItemRequest({ ...values, name: "  Tên mới  " }, item)).toEqual({
      name: "Tên mới",
    });
    expect(
      menuItemRequest(
        { ...values, coverMediaId: null, coverUrl: null, tagIds: [] },
        item,
      ),
    ).toEqual({ coverMediaId: null, tagIds: [] });
    expect(
      validateMenuItem({ ...values, description: "ngắn" }, item),
    ).toHaveProperty("description");
  });
  it("validates numeric precision, trimmed text limits, exact dish forms, tag IDs and sort bounds", () => {
    const valid = {
      ...menuItemValues(menuDetailSample.items[0]),
      price: "0",
      sortOrder: "32767",
    };
    expect(validateMenuItem(valid)).toEqual({});
    for (const price of ["", "-1", "1.5", "1000000000000", "Infinity", "NaN"])
      expect(validateMenuItem({ ...valid, price })).toHaveProperty("price");
    expect(validateMenuItem({ ...valid, price: "999999999999" })).toEqual({});
    for (const sortOrder of ["-1", "1.5", "32768"])
      expect(validateMenuItem({ ...valid, sortOrder })).toHaveProperty(
        "sortOrder",
      );
    expect(
      validateMenuItem({
        ...valid,
        name: " ",
        description: "x".repeat(29),
        tagIds: [1, 1],
      }),
    ).toMatchObject({
      name: expect.any(String),
      description: expect.any(String),
      tagIds: expect.any(String),
    });
    expect(
      validateMenuItem({
        ...valid,
        name: "x".repeat(200),
        description: "x".repeat(2000),
      }),
    ).toEqual({});
    expect(
      validateMenuItem({
        ...valid,
        name: "x".repeat(201),
        description: "x".repeat(2001),
      }),
    ).toHaveProperty("name");
    expect(newMenuItemRequest({ ...valid, sortOrder: "" })).not.toHaveProperty(
      "sortOrder",
    );
    expect(
      menuItemRequest(
        { ...valid, tagIds: [9, 2] },
        { ...menuDetailSample.items[0], tagIds: [2, 9] },
      ),
    ).not.toHaveProperty("tagIds");
  });
});
