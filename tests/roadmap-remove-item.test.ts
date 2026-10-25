import { afterEach, describe, expect, it, vi } from "vitest";
import {
  removeItemError,
  removeNotice,
  removeReloadFailed,
} from "@/features/roadmaps/roadmap-remove-item-rules";
import { roadmapService } from "@/features/roadmaps/roadmap-service";
import { ApiError } from "@/shared/api/error";
import {
  roadmapOperation,
  roadmapOperationHasBody,
} from "@/shared/api/roadmap-proxy";

describe("RM-09 proxy rule", () => {
  it("allows exactly DELETE roadmaps/{id}/items/{id}", () => {
    expect(roadmapOperation("DELETE", "roadmaps/88/items/1502")).toBe(true);
    // Other methods, other depths and malformed ids never reach the backend.
    expect(roadmapOperation("GET", "roadmaps/88/items/1502")).toBe(false);
    expect(roadmapOperation("PATCH", "roadmaps/88/items/1502")).toBe(false);
    expect(roadmapOperation("DELETE", "roadmaps/88")).toBe(false);
    expect(roadmapOperation("DELETE", "roadmaps/88/items")).toBe(false);
    expect(roadmapOperation("DELETE", "roadmaps/88/items/0")).toBe(false);
    expect(roadmapOperation("DELETE", "roadmaps/88/items/1502/feedback")).toBe(
      false,
    );
    expect(roadmapOperation("DELETE", "roadmaps/x/items/1")).toBe(false);
    expect(roadmapOperation("DELETE", "roadmaps/88/days/301/items")).toBe(
      false,
    );
  });
  it("does not ask a DELETE for a JSON body, but still asks the writes that have one", () => {
    expect(roadmapOperationHasBody("DELETE")).toBe(false);
    expect(roadmapOperationHasBody("GET")).toBe(false);
    expect(roadmapOperationHasBody("POST")).toBe(true);
    expect(roadmapOperationHasBody("PATCH")).toBe(true);
  });
});

describe("RM-09 service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("calls DELETE on the item path through the proxy and resolves with nothing", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    await expect(roadmapService.deleteItem(88, 1502)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/backend/roadmaps/88/items/1502");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

describe("RM-09 errors and messages", () => {
  it("tells an item that is already gone from other failures", () => {
    expect(
      removeItemError(new ApiError(404, "ROADMAP_ITEM_NOT_FOUND", "x")),
    ).toMatchObject({ gone: true });
    const other = removeItemError(
      new ApiError(503, "SERVICE_UNAVAILABLE", "x"),
    );
    expect(other.gone).toBe(false);
    expect(other.message).toMatch(/kết nối/);
    expect(removeItemError(new Error("boom")).gone).toBe(false);
  });
  it("words what happened for the traveler", () => {
    expect(removeNotice("removed", "Bún bò Huế")).toBe(
      "Đã xóa Bún bò Huế khỏi lộ trình.",
    );
    expect(removeNotice("already-gone", "Bún bò Huế")).toMatch(
      /Bún bò Huế không còn trong lộ trình/,
    );
    expect(removeReloadFailed).toMatch(/đã được xóa nhưng chưa tải lại/);
  });
});
