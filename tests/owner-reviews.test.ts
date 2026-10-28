import { afterEach, describe, expect, it, vi } from "vitest";
import { ownerReviewsService as service } from "@/features/owner/owner-reviews-service";
import {
  REPLY_MAX_LENGTH,
  canReply,
  ownerReviewCounts,
  ownerReviewFieldErrors,
  ownerReviewsErrorMessage,
  ownerReviewsQuery,
  ownerReviewsQueryString,
  replyRequest,
  replyStatusLabels,
  validateReplyContent,
} from "@/features/owner/owner-reviews-rules";
import { ownerReviewsOperation } from "@/shared/api/owner-reviews-proxy";
import { ApiError } from "@/shared/api/error";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OWN-19 query contract", () => {
  it("sends only the filters that differ from 'all'", () => {
    expect(ownerReviewsQuery("all", "all", 1, 10)).toEqual({
      page: 1,
      pageSize: 10,
    });
    expect(ownerReviewsQuery("unanswered", 5, 2, 20)).toEqual({
      page: 2,
      pageSize: 20,
      replied: false,
      rating: 5,
    });
    expect(ownerReviewsQuery("answered", "all", 1, 10)).toEqual({
      page: 1,
      pageSize: 10,
      replied: true,
    });
  });

  it("always carries page and pageSize and encodes the booleans", () => {
    expect(ownerReviewsQueryString(ownerReviewsQuery("all", "all", 1, 10))).toBe(
      "page=1&pageSize=10",
    );
    expect(
      ownerReviewsQueryString(ownerReviewsQuery("answered", 3, 4, 25)),
    ).toBe("page=4&pageSize=25&replied=true&rating=3");
    expect(
      ownerReviewsQueryString(ownerReviewsQuery("unanswered", "all", 1, 10)),
    ).toBe("page=1&pageSize=10&replied=false");
  });
});

describe("OWN-20 body contract", () => {
  it("trims the content and rejects empty or oversized replies", () => {
    expect(replyRequest("  Xin cảm ơn  ")).toEqual({ content: "Xin cảm ơn" });
    expect(validateReplyContent("   ")).toBe("Phản hồi không được để trống.");
    expect(validateReplyContent("")).toBe("Phản hồi không được để trống.");
    expect(validateReplyContent("x".repeat(REPLY_MAX_LENGTH))).toBeNull();
    expect(validateReplyContent("x".repeat(REPLY_MAX_LENGTH + 1))).toBe(
      `Phản hồi không vượt quá ${REPLY_MAX_LENGTH} ký tự.`,
    );
  });

  it("labels every reply status of the contract", () => {
    expect(Object.keys(replyStatusLabels).sort()).toEqual([
      "hidden",
      "removed",
      "visible",
    ]);
    expect(canReply("visible")).toBe(true);
    expect(canReply("hidden")).toBe(false);
    expect(canReply("removed")).toBe(false);
  });
});

describe("owner reviews service", () => {
  it("reads OWN-19 with the filtered query and sends OWN-20 with the review id", async () => {
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");

    await service.list(ownerReviewsQuery("unanswered", 4, 2, 10));
    await service.reply(91, { content: "Cảm ơn bạn" });

    expect(
      fetch.mock.calls.map(([path, options]) => [
        String(path).replace(/^.*\/backend\//, ""),
        options.method ?? "GET",
      ]),
    ).toEqual([
      [
        "owner/restaurant/reviews?page=2&pageSize=10&replied=false&rating=4",
        "GET",
      ],
      ["owner/restaurant/reviews/91/reply", "PUT"],
    ]);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      content: "Cảm ơn bạn",
    });
  });
});

describe("owner reviews proxy allowlist", () => {
  it("accepts only the exact OWN-19 and OWN-20 operations", () => {
    expect(ownerReviewsOperation("GET", "owner/restaurant/reviews")).toEqual({
      body: false,
      status: 200,
    });
    expect(
      ownerReviewsOperation("PUT", "owner/restaurant/reviews/12/reply"),
    ).toEqual({ body: true, status: 200 });
  });

  it("rejects every other method and every malformed id", () => {
    for (const path of [
      "owner/restaurant/reviews/0/reply",
      "owner/restaurant/reviews/-1/reply",
      "owner/restaurant/reviews/12/reply/extra",
      "owner/restaurant/reviews/abc/reply",
      "owner/restaurant/review/12/reply",
    ])
      for (const method of ["GET", "POST", "PATCH", "DELETE", "PUT"])
        expect(ownerReviewsOperation(method, path)).toBeNull();
    expect(ownerReviewsOperation("DELETE", "owner/restaurant/reviews/12/reply")).toBeNull();
    expect(ownerReviewsOperation("GET", "owner/restaurant/reviews/12")).toBeNull();
  });
});

describe("owner reviews presentation rules", () => {
  it("sums the answered and unanswered counters of the restaurant", () => {
    expect(ownerReviewCounts({ answered: 4, unanswered: 6 })).toEqual({
      answered: 4,
      unanswered: 6,
    });
    expect(ownerReviewCounts({ answered: -1, unanswered: 0 })).toEqual({
      answered: 0,
      unanswered: 0,
    });
  });

  it("maps the backend error codes to actionable messages", () => {
    expect(ownerReviewsErrorMessage(new ApiError(409, "REVIEW_NOT_VISIBLE", ""))).toContain(
      "không thể phản hồi",
    );
    expect(ownerReviewsErrorMessage(new ApiError(404, "REVIEW_NOT_FOUND", ""))).toContain(
      "Không tìm thấy đánh giá",
    );
    expect(
      ownerReviewsErrorMessage(new ApiError(404, "RESTAURANT_NOT_FOUND", "")),
    ).toContain("chưa đăng ký nhà hàng");
  });

  it("lowercases the first letter of the field errors", () => {
    expect(
      ownerReviewFieldErrors(
        new ApiError(400, "VALIDATION_FAILED", "", {
          Content: ["Nội dung phản hồi không được để trống."],
        }),
      ),
    ).toEqual({ content: "Nội dung phản hồi không được để trống." });
    expect(ownerReviewFieldErrors(new Error("x"))).toEqual({});
  });
});
