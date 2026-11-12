import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canLiftRestriction,
  canSanction,
  moderationUsersService,
  sanctionTypeLabels,
  userStatusLabels,
} from "@/features/moderation/moderation-users-service";
import {
  blogStatusLabels,
  commentStatusLabels,
  moderationBlogsService,
} from "@/features/moderation/moderation-blogs-service";
import {
  moderationBlogsOperation,
  moderationUsersOperation,
} from "@/shared/api/moderation-proxy";

function jsonResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      message: null,
      errorCode: null,
      data,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

/** Mock của `fetch` ghi lại url và init để test kiểm tra đúng đường dẫn. */
function fetchStub(data: unknown) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    void url;
    void init;
    return jsonResponse(data);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("MOD-U proxy rules", () => {
  it("allows exactly the four user operations", () => {
    expect(moderationUsersOperation("GET", "mod/users")).toMatchObject({
      body: false,
      status: 200,
    });
    expect(moderationUsersOperation("GET", "mod/users/42")).toMatchObject({
      body: false,
      status: 200,
    });
    // MOD-U3 tạo xử phạt nên trả 201.
    expect(
      moderationUsersOperation("POST", "mod/users/42/sanctions"),
    ).toMatchObject({ body: true, status: 201 });
    expect(
      moderationUsersOperation("POST", "mod/users/42/unban"),
    ).toMatchObject({ body: true, status: 200 });
  });

  it("rejects any other user path", () => {
    for (const [method, path] of [
      ["GET", "mod/users/42/sanctions"],
      ["POST", "mod/users/42"],
      ["PUT", "mod/users/42/status"],
      ["GET", "mod/users/abc"],
      ["GET", "mod/users/0"],
      ["POST", "mod/users/42/unban/extra"],
      ["DELETE", "mod/users/42"],
    ])
      expect(
        moderationUsersOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("MOD-B proxy rules", () => {
  it("allows the blog list and both status updates", () => {
    expect(moderationBlogsOperation("GET", "mod/blogs")).toMatchObject({
      body: false,
      status: 200,
    });
    expect(
      moderationBlogsOperation("PUT", "mod/blogs/7/status"),
    ).toMatchObject({ body: true, status: 200 });
    expect(
      moderationBlogsOperation("PUT", "mod/blog-comments/9/status"),
    ).toMatchObject({ body: true, status: 200 });
  });

  it("rejects any other content path", () => {
    for (const [method, path] of [
      ["GET", "mod/blogs/7"],
      ["POST", "mod/blogs/7/status"],
      ["PUT", "mod/blogs/7"],
      ["DELETE", "mod/blog-comments/9/status"],
      ["PUT", "mod/blog-comments/abc/status"],
      ["PUT", "mod/blogs/0/status"],
    ])
      expect(
        moderationBlogsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("MOD-U service", () => {
  it("lists users with only the filters the backend accepts", async () => {
    const fetchMock = fetchStub({ items: [], totalItems: 0 });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationUsersService.list({
      q: "an",
      role: "TRAVELER",
      status: "banned",
      page: 2,
      pageSize: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/backend/mod/users?q=an&role=TRAVELER&status=banned&page=2&pageSize=20",
    );
  });

  it("omits the filters that were not chosen", async () => {
    const fetchMock = fetchStub({ items: [] });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationUsersService.list({});
    expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/mod/users");
  });

  it("creates a sanction with POST and the documented body", async () => {
    const fetchMock = fetchStub({ id: 5 });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationUsersService.sanction(42, {
      type: "suspend",
      reason: "Spam lặp lại",
      endsAt: "2026-12-01T00:00:00.000Z",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/mod/users/42/sanctions");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      type: "suspend",
      reason: "Spam lặp lại",
      endsAt: "2026-12-01T00:00:00.000Z",
    });
  });

  it("lifts a restriction with POST and the lift reason", async () => {
    const fetchMock = fetchStub({ id: 42 });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationUsersService.unban(42, { liftReason: "Đã hoàn tất xử lý" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/mod/users/42/unban");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      liftReason: "Đã hoàn tất xử lý",
    });
  });
});

describe("MOD-B service", () => {
  it("lists blogs with the documented filters", async () => {
    const fetchMock = fetchStub({ items: [], totalItems: 0 });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationBlogsService.list({
      q: "review",
      status: "hidden",
      reported: true,
      page: 1,
      pageSize: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/backend/mod/blogs?q=review&status=hidden&reported=true&page=1&pageSize=20",
    );
  });

  it("updates a blog status with PUT", async () => {
    const fetchMock = fetchStub({ blogId: 7, status: "hidden" });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationBlogsService.setBlogStatus(7, {
      status: "hidden",
      reason: "Nội dung không phù hợp",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/mod/blogs/7/status");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({
      status: "hidden",
      reason: "Nội dung không phù hợp",
    });
  });

  it("updates a comment status with PUT on the comment endpoint", async () => {
    const fetchMock = fetchStub({ commentId: 9, status: "hidden" });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationBlogsService.setCommentStatus(9, {
      status: "hidden",
      reason: "Bình luận xúc phạm",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/mod/blog-comments/9/status");
    expect(init?.method).toBe("PUT");
  });
});

describe("MOD-U and MOD-B helpers", () => {
  it("only offers to lift a restriction that is actually active", () => {
    expect(canLiftRestriction("suspended")).toBe(true);
    expect(canLiftRestriction("banned")).toBe(true);
    expect(canLiftRestriction("active")).toBe(false);
    expect(canLiftRestriction("pending_verification")).toBe(false);
    expect(canLiftRestriction("deactivated")).toBe(false);
  });

  it("hides the sanction action for a banned account (USER_ALREADY_BANNED)", () => {
    expect(canSanction("banned")).toBe(false);
    expect(canSanction("active")).toBe(true);
    expect(canSanction("suspended")).toBe(true);
  });

  it("labels every status the backend can return", () => {
    for (const status of [
      "pending_verification",
      "active",
      "suspended",
      "banned",
      "deactivated",
    ])
      expect(userStatusLabels[status]).toBeTruthy();
    for (const type of ["warn", "suspend", "ban"])
      expect(sanctionTypeLabels[type]).toBeTruthy();
    for (const status of ["published", "hidden", "removed"])
      expect(blogStatusLabels[status]).toBeTruthy();
    for (const status of ["visible", "hidden", "removed"])
      expect(commentStatusLabels[status]).toBeTruthy();
  });
});
