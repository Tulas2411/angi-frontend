import { describe, expect, it } from "vitest";
import {
  actionEffect,
  nextStatuses,
  reasonProblem,
  reviewModerationError,
} from "@/features/moderation/review-moderation-rules";
import { modReviewsQueryString } from "@/features/moderation/review-moderation-service";
import { moderationReviewsOperation } from "@/shared/api/moderation-proxy";
import { ApiError } from "@/shared/api/error";

describe("MOD-F requests", () => {
  it("sends only the MOD-F1 filters that are set", () => {
    expect(modReviewsQueryString({})).toBe("");
    expect(
      modReviewsQueryString({
        q: "phở",
        rating: 1,
        status: "hidden",
        page: 2,
        pageSize: 20,
      }),
    ).toBe("?q=ph%E1%BB%9F&rating=1&status=hidden&page=2&pageSize=20");
  });

  it("lets exactly MOD-F1..MOD-F3 through the proxy", () => {
    expect(moderationReviewsOperation("GET", "mod/reviews")).toEqual({
      body: false,
      status: 200,
    });
    expect(
      moderationReviewsOperation("PUT", "mod/reviews/640/status")?.body,
    ).toBe(true);
    expect(
      moderationReviewsOperation("PUT", "mod/reviews/640/reply/status")?.body,
    ).toBe(true);
    for (const [method, path] of [
      ["GET", "mod/reviews/640"],
      ["POST", "mod/reviews/640/status"],
      ["PUT", "mod/reviews/0/status"],
      ["PUT", "mod/reviews/640/reply"],
      ["DELETE", "mod/reviews/640"],
    ])
      expect(
        moderationReviewsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("MOD-F rules", () => {
  it("offers the two other statuses, never the current one", () => {
    expect(nextStatuses("visible")).toEqual(["hidden", "removed"]);
    expect(nextStatuses("removed")).toEqual(["visible", "hidden"]);
  });

  it("needs a reason of 1..1000 characters", () => {
    expect(reasonProblem(" ")).toContain("Ghi lý do");
    expect(reasonProblem("x".repeat(1001))).toContain("1000");
    expect(reasonProblem("Quảng cáo")).toBe("");
  });

  it("explains each move and words the error codes", () => {
    expect(actionEffect("review", "hidden")).toContain(
      "không còn tính vào điểm",
    );
    expect(actionEffect("reply", "removed")).toContain("chủ quán");
    expect(
      reviewModerationError(new ApiError(404, "REVIEW_NOT_FOUND", "x")),
    ).toBe("Không tìm thấy đánh giá này.");
    expect(
      reviewModerationError(
        new ApiError(
          400,
          "VALIDATION_FAILED",
          "Bài đánh giá chưa có phản hồi từ chủ nhà hàng.",
        ),
      ),
    ).toBe("Bài đánh giá chưa có phản hồi từ chủ nhà hàng.");
  });
});
