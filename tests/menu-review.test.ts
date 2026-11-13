import { describe, expect, it, vi } from "vitest";
import {
  beforeFromDish,
  compareItems,
  itemChanges,
  itemCounts,
  menuDecisionProblem,
  menuReviewError,
  menuStatusTone,
  previousApproved,
  tagNamesOf,
} from "@/features/moderation/menu-review-rules";
import {
  loadApprovedBaseline,
  loadApprovedCounts,
  menuSubmissionsQueryString,
  type MenuReviewService,
} from "@/features/moderation/menu-review-service";
import type { ModMenuItemDiffDto } from "@/features/moderation/menu-review-types";
import type { MenuItemDto } from "@/features/owner/menu-types";
import { moderationMenusOperation } from "@/shared/api/moderation-proxy";
import { ApiError } from "@/shared/api/error";
import { money } from "@/shared/format";

const before = {
  id: 105,
  name: "Bún bò Huế",
  price: 45000,
  coverUrl: "https://cdn.angi.test/old.jpg",
  dishForm: "soup" as const,
  isAvailable: true,
  likeCount: 128,
  dislikeCount: 9,
  tags: [{ id: 3, tagType: "category" as const, code: "bun", name: "Bún" }],
  restaurant: {
    id: 7,
    name: "Bún Bò Bà Diệu",
    district: null,
    provinceName: "Thành phố Đà Nẵng",
    latitude: null,
    longitude: null,
    ratingAvg: 4.6,
  },
  rank: null,
};
const item = (over: Partial<ModMenuItemDiffDto> = {}): ModMenuItemDiffDto => ({
  id: 501,
  sourceDishId: 105,
  change: "edited",
  name: "Bún bò Huế",
  description: "Nước dùng hầm xương",
  dishForm: "soup",
  price: 45000,
  coverMediaId: null,
  coverUrl: "https://cdn.angi.test/old.jpg",
  tagIds: [3],
  sortOrder: 1,
  resultDishId: null,
  before,
  ...over,
});
const names = tagNamesOf([
  { id: 3, name: "Bún" },
  { id: 8, name: "Cay" },
]);

const changesOf = (entry: ModMenuItemDiffDto) =>
  itemChanges(entry, entry.before ? beforeFromDish(entry.before) : null, names);

/** A row of an earlier approved submission (its dish is `resultDishId`). */
const snapshot = (over: Partial<MenuItemDto> = {}): MenuItemDto => ({
  id: 401,
  sourceDishId: 105,
  change: "unchanged",
  name: "Bún bò Huế",
  description: "Nước dùng hầm xương",
  dishForm: "soup",
  price: 45000,
  coverMediaId: 77,
  coverUrl: "https://cdn.angi.test/old.jpg",
  tagIds: [3],
  sortOrder: 1,
  resultDishId: 105,
  ...over,
});

describe("F-58 comparison with the running menu", () => {
  it("lists only the fields an edited dish changes", () => {
    expect(changesOf(item())).toEqual([]);
    expect(
      changesOf(
        item({
          price: 50000,
          tagIds: [3, 8],
          coverUrl: "https://cdn.angi.test/new.jpg",
        }),
      ).map((row) => [row.label, row.before, row.after]),
    ).toEqual([
      ["Giá", money(45000), money(50000)],
      ["Thẻ", "Bún", "Bún, Cay"],
      ["Ảnh món", "Ảnh cũ", "Ảnh mới"],
    ]);
    expect(
      changesOf(item({ name: "Bún bò đặc biệt", dishForm: "dry" })).map(
        (row) => row.label,
      ),
    ).toEqual(["Tên món", "Loại món"]);
  });

  it("compares the description only when the running dish carries it", () => {
    expect(changesOf(item({ description: "Nước dùng mới" }))).toEqual([]);
    expect(
      changesOf(
        item({
          description: "Nước dùng mới",
          before: { ...before, description: "Nước dùng hầm xương" },
        }),
      ).map((row) => [row.label, row.before, row.after]),
    ).toEqual([["Mô tả", "Nước dùng hầm xương", "Nước dùng mới"]]);
  });

  it("has nothing to compare for a new dish", () => {
    expect(changesOf(item({ change: "new", before: null }))).toEqual([]);
  });
});

describe("F-58 approved submission compared with the menu it replaced", () => {
  it("keeps MOD-M2 as sent when there is no baseline", () => {
    const [entry] = compareItems([item({ price: 50000 })], null);
    expect(entry.change).toBe("edited");
    expect(entry.before?.price).toBe(45000);
  });

  it("finds the edit MOD-M2 reports as unchanged after approval", () => {
    // After approval the dish on sale already holds 50 000 ₫, so MOD-M2 says "unchanged".
    const approved = item({
      change: "unchanged",
      before: null,
      price: 50000,
      coverMediaId: 77,
    });
    const [entry] = compareItems([approved], [snapshot()]);
    expect(entry.change).toBe("edited");
    expect(
      itemChanges(entry.item, entry.before, names).map((row) => [
        row.label,
        row.before,
        row.after,
      ]),
    ).toEqual([["Giá", money(45000), money(50000)]]);
  });

  it("compares photo by media id and shows a moved dish", () => {
    const [entry] = compareItems(
      [
        item({
          change: "unchanged",
          before: null,
          coverMediaId: 78,
          coverUrl: "https://cdn.angi.test/new.jpg",
          sortOrder: 3,
        }),
      ],
      [snapshot()],
    );
    expect(entry.change).toBe("edited");
    expect(
      itemChanges(entry.item, entry.before, names).map((row) => row.label),
    ).toEqual(["Ảnh món", "Thứ tự"]);
  });

  it("leaves a really unchanged dish, a new dish and an unknown dish alone", () => {
    const result = compareItems(
      [
        item({ change: "unchanged", before: null, coverMediaId: 77 }),
        item({ id: 502, sourceDishId: null, change: "new", before: null }),
        item({ id: 503, sourceDishId: 999, change: "unchanged", before: null }),
      ],
      [snapshot()],
    );
    expect(result.map((entry) => entry.change)).toEqual([
      "unchanged",
      "new",
      "unchanged",
    ]);
    expect(result.map((entry) => entry.before === null)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("picks the approved submission reviewed last before this one", () => {
    const card = (
      id: number,
      reviewedAt: string | null,
      status = "approved",
    ) => ({ id, status, reviewedAt });
    const cards = [
      card(10, "2026-11-01T00:00:00Z"),
      card(12, "2026-11-05T00:00:00Z"),
      card(14, "2026-11-12T15:35:19Z"),
      card(15, "2026-11-13T00:00:00Z"),
      card(11, "2026-11-08T00:00:00Z", "rejected"),
      card(13, null),
    ];
    expect(
      previousApproved(cards, { id: 14, reviewedAt: "2026-11-12T15:35:19Z" })
        ?.id,
    ).toBe(12);
    expect(
      previousApproved(cards, { id: 10, reviewedAt: "2026-11-01T00:00:00Z" }),
    ).toBeNull();
    expect(previousApproved(cards, { id: 14, reviewedAt: null })).toBeNull();
  });

  it("loads the baseline through MOD-M1 (by restaurant) and MOD-M2", async () => {
    const list = vi.fn(async () => ({
      items: [
        { id: 12, status: "approved", reviewedAt: "2026-11-05T00:00:00Z" },
        { id: 14, status: "approved", reviewedAt: "2026-11-12T00:00:00Z" },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 2,
      totalPages: 1,
    }));
    const detail = vi.fn(async (id: number) => ({
      id,
      reviewedAt: "2026-11-05T00:00:00Z",
      items: [snapshot()],
    }));
    const service = { list, detail } as unknown as MenuReviewService;
    const result = await loadApprovedBaseline(service, {
      id: 14,
      restaurantId: 7,
      reviewedAt: "2026-11-12T00:00:00Z",
    });
    expect(list).toHaveBeenCalledWith({
      status: "approved",
      restaurantId: 7,
      page: 1,
      pageSize: 100,
    });
    expect(detail).toHaveBeenCalledWith(12);
    expect(result?.submissionId).toBe(12);
    expect(result?.items).toHaveLength(1);
  });

  it("has no baseline for the first approved menu of a restaurant", async () => {
    const detail = vi.fn();
    const service = {
      list: async () => ({
        items: [
          { id: 14, status: "approved", reviewedAt: "2026-11-12T00:00:00Z" },
        ],
        page: 1,
        pageSize: 100,
        totalItems: 1,
        totalPages: 1,
      }),
      detail,
    } as unknown as MenuReviewService;
    expect(
      await loadApprovedBaseline(service, {
        id: 14,
        restaurantId: 7,
        reviewedAt: "2026-11-12T00:00:00Z",
      }),
    ).toBeNull();
    expect(detail).not.toHaveBeenCalled();
  });
});

describe("F-58 counts", () => {
  it("counts new, edited, unchanged and removed dishes", () => {
    expect(
      itemCounts(
        [
          item({ change: "new", before: null }),
          item(),
          item({ change: "unchanged" }),
        ],
        2,
      ),
    ).toEqual({ all: 5, new: 1, edited: 1, unchanged: 1, removed: 2 });
  });
});

describe("F-58 decision and errors", () => {
  it("needs a reason to reject, never to approve", () => {
    expect(menuDecisionProblem("approve", "")).toBe("");
    expect(menuDecisionProblem("reject", "  ")).toBe(
      "Ghi lý do từ chối để chủ quán biết cần sửa món nào.",
    );
    expect(menuDecisionProblem("approve", "x".repeat(1001))).toBe(
      "Ghi chú không được vượt quá 1000 ký tự.",
    );
  });

  it("words the codes of the Mã lỗi sheet", () => {
    expect(
      menuReviewError(new ApiError(409, "SUBMISSION_NOT_PENDING", "x")),
    ).toContain("không còn chờ duyệt");
    expect(
      menuReviewError(new ApiError(404, "SUBMISSION_NOT_FOUND", "x")),
    ).toBe("Không tìm thấy bản thực đơn này.");
    expect(menuStatusTone("approved")).toBe("success");
    expect(menuStatusTone("pending")).toBe("warning");
  });
});

describe("F-58 requests and proxy", () => {
  it("always sends the status", () => {
    expect(
      menuSubmissionsQueryString({ status: "pending", page: 1, pageSize: 20 }),
    ).toBe("?status=pending&page=1&pageSize=20");
    expect(
      menuSubmissionsQueryString({ status: "approved", restaurantId: 7 }),
    ).toBe("?status=approved&restaurantId=7");
  });

  it("lets exactly MOD-M1..MOD-M4 through", () => {
    expect(moderationMenusOperation("GET", "mod/menu-submissions")?.body).toBe(
      false,
    );
    expect(
      moderationMenusOperation("GET", "mod/menu-submissions/14")?.body,
    ).toBe(false);
    expect(
      moderationMenusOperation("POST", "mod/menu-submissions/14/approve"),
    ).toEqual({
      body: true,
      status: 200,
    });
    expect(
      moderationMenusOperation("POST", "mod/menu-submissions/14/reject")?.body,
    ).toBe(true);
    for (const [method, path] of [
      ["POST", "mod/menu-submissions"],
      ["GET", "mod/menu-submissions/0"],
      ["GET", "mod/menu-submissions/14/approve"],
      ["POST", "mod/menu-submissions/14/cancel"],
      ["DELETE", "mod/menu-submissions/14"],
    ])
      expect(
        moderationMenusOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("F-58 approved queue counts", () => {
  // #28 edits the tags of dish 106; #29 then edits the price of dish 105. After both approvals
  // MOD-M1 says #29 edits nothing and #28 edits dish 105, because it compares with today's menu.
  const row = (id: number, dishId: number, over: Partial<MenuItemDto> = {}) =>
    snapshot({ id, sourceDishId: dishId, resultDishId: dishId, ...over });
  const menus: Record<number, { items: MenuItemDto[]; removed: number }> = {
    3: { items: [row(1, 105), row(2, 106, { tagIds: [3] })], removed: 0 },
    28: { items: [row(3, 105), row(4, 106, { tagIds: [3, 8] })], removed: 0 },
    29: {
      items: [row(5, 105, { price: 50000 }), row(6, 106, { tagIds: [3, 8] })],
      removed: 0,
    },
  };
  const approvedCards = [
    {
      id: 3,
      restaurantId: 7,
      status: "approved",
      reviewedAt: "2026-10-07T03:22:22Z",
    },
    {
      id: 28,
      restaurantId: 7,
      status: "approved",
      reviewedAt: "2026-11-12T15:32:08Z",
    },
    {
      id: 29,
      restaurantId: 7,
      status: "approved",
      reviewedAt: "2026-11-12T15:35:19Z",
    },
  ];
  const fakeService = (failing: number[] = []) => {
    const list = vi.fn(async () => ({
      items: approvedCards,
      page: 1,
      pageSize: 100,
      totalItems: approvedCards.length,
      totalPages: 1,
    }));
    const detail = vi.fn(async (id: number) => {
      if (failing.includes(id)) throw new ApiError(500, "INTERNAL_ERROR", "x");
      return {
        id,
        items: menus[id].items.map((entry) => ({
          ...entry,
          change: "unchanged" as const,
          before: null,
        })),
        removedDishes: Array(menus[id].removed).fill(before),
      };
    });
    return {
      list,
      detail,
      service: { list, detail } as unknown as MenuReviewService,
    };
  };

  it("counts each approved card against the menu it replaced", async () => {
    const { service, list, detail } = fakeService();
    const counts = await loadApprovedCounts(service, [
      approvedCards[2],
      approvedCards[1],
    ]);
    expect(counts.get(29)).toMatchObject({ new: 0, edited: 1, removed: 0 });
    expect(counts.get(28)).toMatchObject({ new: 0, edited: 1, removed: 0 });
    // One MOD-M1 call for the restaurant; #28 is loaded once though it is a card and a baseline.
    expect(list).toHaveBeenCalledTimes(1);
    expect(detail.mock.calls.map(([id]) => id).sort()).toEqual([28, 29, 3]);
  });

  it("gives up on one card without losing the others", async () => {
    const { service } = fakeService([3]);
    const counts = await loadApprovedCounts(service, [
      approvedCards[2],
      approvedCards[1],
    ]);
    expect(counts.get(28)).toBeNull();
    expect(counts.get(29)).toMatchObject({ edited: 1 });
  });
});
