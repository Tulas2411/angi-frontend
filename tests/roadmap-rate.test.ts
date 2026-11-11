import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ratedNotice,
  rateFailedNotice,
  rateItemError,
  rateReloadFailed,
  ratingButtonLabel,
  ratingLabels,
} from "@/features/roadmaps/roadmap-rate-rules";
import { roadmapService } from "@/features/roadmaps/roadmap-service";
import { ApiError } from "@/shared/api/error";
import { roadmapOperation } from "@/shared/api/roadmap-proxy";

describe("RM-13 button text", () => {
  it("names each button by its action and the dish, without any totals", () => {
    expect(ratingButtonLabel("like", "Bún bò Huế", null)).toBe(
      "Thích Bún bò Huế",
    );
    expect(ratingButtonLabel("dislike", "Bún bò Huế", null)).toBe(
      "Không thích Bún bò Huế",
    );
    // Once rated, the chosen button says so and the other one keeps its action.
    expect(ratingButtonLabel("like", "Bún bò Huế", "like")).toBe(
      "Bạn đã thích Bún bò Huế",
    );
    expect(ratingButtonLabel("dislike", "Bún bò Huế", "dislike")).toBe(
      "Bạn đã không thích Bún bò Huế",
    );
    expect(ratingButtonLabel("dislike", "Bún bò Huế", "like")).toBe(
      "Không thích Bún bò Huế",
    );
    expect(ratingLabels.like.action).toBe("Thích");
    expect(ratingLabels.dislike.action).toBe("Không thích");
  });
  it("words what happened after a rating", () => {
    expect(ratedNotice("like", "Bún bò Huế")).toBe(
      "Đã ghi nhận bạn thích Bún bò Huế.",
    );
    expect(ratedNotice("dislike", "Bún bò Huế")).toBe(
      "Đã ghi nhận bạn không thích Bún bò Huế.",
    );
    expect(rateFailedNotice("Bún bò Huế", "Lỗi mạng.")).toBe(
      "Chưa ghi nhận được đánh giá cho Bún bò Huế. Lỗi mạng.",
    );
    expect(rateReloadFailed).toMatch(/Đã ghi nhận đánh giá/);
  });
});

describe("RM-13 errors by errorCode", () => {
  it("settles a dish that was rated before or has left the roadmap", () => {
    const already = rateItemError(
      new ApiError(409, "FEEDBACK_ALREADY_EXISTS", "x"),
      "Bún bò Huế",
    );
    expect(already.settled).toBe("already-rated");
    expect(already.message).toMatch(/Bún bò Huế đã được đánh giá trước đó/);
    const gone = rateItemError(
      new ApiError(404, "ROADMAP_ITEM_NOT_FOUND", "x"),
      "Bún bò Huế",
    );
    expect(gone.settled).toBe("gone");
    expect(gone.message).toMatch(/không còn trong lộ trình/);
  });
  it("leaves every other failure to be tried again", () => {
    for (const error of [
      new ApiError(503, "SERVICE_UNAVAILABLE", "x"),
      new ApiError(400, "VALIDATION_FAILED", "x"),
      new Error("boom"),
    ])
      expect(rateItemError(error, "Bún bò Huế").settled).toBeNull();
    expect(
      rateItemError(new ApiError(503, "SERVICE_UNAVAILABLE", "x"), "x").message,
    ).toMatch(/kết nối/);
    expect(
      rateItemError(new ApiError(400, "VALIDATION_FAILED", "x"), "x").message,
    ).toMatch(/chưa hợp lệ/);
  });
});

describe("RM-13 proxy rule and service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("allows exactly POST roadmaps/{id}/items/{id}/feedback", () => {
    expect(roadmapOperation("POST", "roadmaps/88/items/1502/feedback")).toBe(
      true,
    );
    // A rating cannot be changed or removed, and nothing around the path is open.
    for (const [method, path] of [
      ["PUT", "roadmaps/88/items/1502/feedback"],
      ["PATCH", "roadmaps/88/items/1502/feedback"],
      ["DELETE", "roadmaps/88/items/1502/feedback"],
      ["GET", "roadmaps/88/items/1502/feedback"],
      ["POST", "roadmaps/88/items/1502"],
      ["POST", "roadmaps/88/items/0/feedback"],
      ["POST", "roadmaps/88/items/abc/feedback"],
      ["POST", "roadmaps/88/items/1502/feedback/extra"],
      ["POST", "roadmaps/88/feedback"],
    ])
      expect(roadmapOperation(method, path), `${method} ${path}`).toBe(false);
  });
  it("posts the rating to the item and reads the counters back", async () => {
    const created = {
      feedbackId: 2201,
      value: "like",
      dishId: 105,
      likeCount: 129,
      dislikeCount: 9,
      createdAt: "2026-10-10T02:00:00Z",
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: created,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      roadmapService.rateItem(88, 1502, { value: "like" }),
    ).resolves.toEqual(created);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/backend/roadmaps/88/items/1502/feedback");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ value: "like" });
  });
});
