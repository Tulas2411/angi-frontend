import { describe, expect, it } from "vitest";
import {
  itemChanges,
  itemCounts,
  menuDecisionProblem,
  menuReviewError,
  menuStatusTone,
  tagNamesOf,
} from "@/features/moderation/menu-review-rules";
import { menuSubmissionsQueryString } from "@/features/moderation/menu-review-service";
import type { ModMenuItemDiffDto } from "@/features/moderation/menu-review-types";
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

describe("F-58 comparison with the running menu", () => {
  it("lists only the fields an edited dish changes", () => {
    expect(itemChanges(item(), names)).toEqual([]);
    expect(
      itemChanges(
        item({
          price: 50000,
          tagIds: [3, 8],
          coverUrl: "https://cdn.angi.test/new.jpg",
        }),
        names,
      ).map((row) => [row.label, row.before, row.after]),
    ).toEqual([
      ["Giá", money(45000), money(50000)],
      ["Thẻ", "Bún", "Bún, Cay"],
      ["Ảnh món", "Ảnh cũ", "Ảnh mới"],
    ]);
    expect(
      itemChanges(
        item({ name: "Bún bò đặc biệt", dishForm: "dry" }),
        names,
      ).map((row) => row.label),
    ).toEqual(["Tên món", "Loại món"]);
  });

  it("has nothing to compare for a new dish", () => {
    expect(itemChanges(item({ change: "new", before: null }), names)).toEqual(
      [],
    );
  });

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
