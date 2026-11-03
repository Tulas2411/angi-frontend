import { describe, expect, it } from "vitest";
import {
  auditLabel,
  isOpenReport,
  reasonProblem,
  restaurantModerationError,
} from "@/features/moderation/restaurant-moderation-rules";
import { modRestaurantsQueryString } from "@/features/moderation/restaurant-moderation-service";
import { moderationRestaurantsOperation } from "@/shared/api/moderation-proxy";
import { ApiError } from "@/shared/api/error";

describe("F-56 requests", () => {
  it("sends only the MOD-R1 filters that are set", () => {
    expect(modRestaurantsQueryString({})).toBe("");
    expect(
      modRestaurantsQueryString({
        q: "phở",
        province: "Thành phố Hà Nội",
        moderationStatus: "hidden",
        verificationStatus: "verified",
        operatingStatus: "open",
        hasPendingReports: true,
        page: 2,
        pageSize: 20,
      }),
    ).toBe(
      "?q=ph%E1%BB%9F&province=Th%C3%A0nh+ph%E1%BB%91+H%C3%A0+N%E1%BB%99i&verificationStatus=verified&operatingStatus=open&moderationStatus=hidden&hasPendingReports=true&page=2&pageSize=20",
    );
    expect(modRestaurantsQueryString({ hasPendingReports: false })).toBe("");
  });

  it("lets exactly MOD-R1..MOD-R4 through the proxy", () => {
    expect(moderationRestaurantsOperation("GET", "mod/restaurants")).toEqual({
      body: false,
      status: 200,
    });
    expect(
      moderationRestaurantsOperation("GET", "mod/restaurants/12")?.body,
    ).toBe(false);
    expect(
      moderationRestaurantsOperation(
        "PUT",
        "mod/restaurants/12/moderation-status",
      ),
    ).toEqual({ body: true, status: 200 });
    expect(
      moderationRestaurantsOperation("PUT", "mod/dishes/105/moderation-status"),
    ).toEqual({ body: true, status: 200 });
    for (const [method, path] of [
      ["POST", "mod/restaurants"],
      ["GET", "mod/restaurants/0"],
      ["PATCH", "mod/restaurants/12/moderation-status"],
      ["PUT", "mod/restaurants/12"],
      ["GET", "mod/dishes/105/moderation-status"],
      ["PUT", "mod/dishes/12345678901/moderation-status"],
      ["DELETE", "mod/dishes/105"],
    ])
      expect(
        moderationRestaurantsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("F-56 rules", () => {
  it("needs a reason of 1..1000 characters", () => {
    expect(reasonProblem("  ")).toBe(
      "Ghi lý do để chủ quán và các Mod khác biết vì sao.",
    );
    expect(reasonProblem("x".repeat(1001))).toBe(
      "Lý do không được vượt quá 1000 ký tự.",
    );
    expect(reasonProblem("Nhiều báo cáo về vệ sinh")).toBe("");
  });

  it("words the codes of the Mã lỗi sheet", () => {
    expect(
      restaurantModerationError(new ApiError(409, "DISH_REMOVED", "x")),
    ).toContain("đã bị gỡ khỏi thực đơn");
    expect(
      restaurantModerationError(new ApiError(404, "RESTAURANT_NOT_FOUND", "x")),
    ).toBe("Không tìm thấy nhà hàng này.");
    expect(
      restaurantModerationError(new ApiError(409, "REPORT_CLOSED", "x")),
    ).toContain("đã được xử lý");
    expect(
      restaurantModerationError(
        new ApiError(400, "VALIDATION_FAILED", "x", {
          reportId: ["Báo cáo không thuộc nhà hàng này."],
        }),
      ),
    ).toBe("Báo cáo không thuộc nhà hàng này.");
  });

  it("labels audit actions and keeps unknown codes readable", () => {
    expect(auditLabel("RESTAURANT_HIDDEN")).toBe("Ẩn quán");
    expect(auditLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(isOpenReport("in_review")).toBe(true);
    expect(isOpenReport("resolved")).toBe(false);
  });
});
