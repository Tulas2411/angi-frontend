import { describe, expect, it } from "vitest";
import {
  deleteRoadmapError,
  pageAfterDelete,
} from "@/features/roadmaps/roadmap-list-rules";
import {
  roadmapOperation,
  roadmapOperationHasBody,
} from "@/shared/api/roadmap-proxy";
import { ApiError } from "@/shared/api/error";

describe("RM-05 delete a roadmap", () => {
  it("lets exactly DELETE roadmaps/{id} through the proxy, without a body", () => {
    expect(roadmapOperation("DELETE", "roadmaps/88")).toBe(true);
    expect(roadmapOperationHasBody("DELETE")).toBe(false);
    for (const path of [
      "roadmaps",
      "roadmaps/0",
      "roadmaps/abc",
      "roadmaps/88/",
    ])
      expect(roadmapOperation("DELETE", path), path).toBe(false);
  });

  it("treats ROADMAP_NOT_FOUND as already gone, anything else as a failure to retry", () => {
    expect(
      deleteRoadmapError(new ApiError(404, "ROADMAP_NOT_FOUND", "x")),
    ).toEqual({
      gone: true,
      message: "Lộ trình này không còn nữa (có thể đã được xóa ở nơi khác).",
    });
    const failure = deleteRoadmapError(
      new ApiError(503, "SERVICE_UNAVAILABLE", "x"),
    );
    expect(failure.gone).toBe(false);
    expect(failure.message).toBeTruthy();
  });

  it("goes back one page when the last card of a page was deleted", () => {
    expect(pageAfterDelete(3, 1)).toBe(2);
    expect(pageAfterDelete(3, 5)).toBe(3);
    expect(pageAfterDelete(1, 1)).toBe(1);
  });
});
