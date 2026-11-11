import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canDismissReport,
  conclusionActions,
  isReportOpen,
  moderationReportsService,
  reportStatusTone,
} from "@/features/moderation/moderation-service";
import {
  isModeratorRole,
  moderationReportsOperation,
} from "@/shared/api/moderation-proxy";
import {
  hasPublishedReply,
  ownerReviewsService,
} from "@/features/owner/owner-reviews-service";
import { ownerReviewsOperation } from "@/shared/api/owner-reviews-proxy";
import type { OwnerReviewDto } from "@/features/owner/owner-reviews-types";

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

describe("MOD-RP proxy rules", () => {
  it("allows exactly the four report operations", () => {
    expect(moderationReportsOperation("GET", "mod/reports")).toMatchObject({
      body: false,
      status: 200,
    });
    expect(moderationReportsOperation("GET", "mod/reports/12")).toMatchObject({
      body: false,
      status: 200,
    });
    // MOD-RP3 nhận báo cáo không có body.
    expect(
      moderationReportsOperation("POST", "mod/reports/12/claim"),
    ).toMatchObject({ body: false, status: 200 });
    // MOD-RP4 kết luận có body.
    expect(
      moderationReportsOperation("POST", "mod/reports/12/resolve"),
    ).toMatchObject({ body: true, status: 200 });
  });

  it("rejects any other moderation path", () => {
    for (const [method, path] of [
      ["GET", "mod/users"],
      ["GET", "mod/blogs"],
      ["GET", "mod/reviews"],
      ["POST", "mod/reports/12/resolve/extra"],
      ["GET", "mod/reports/abc"],
      ["GET", "mod/reports/0"],
      ["DELETE", "mod/reports/12"],
      ["GET", "mod/reports/12/claim"],
    ])
      expect(
        moderationReportsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });

  it("lets only MOD and ADMIN into the queue", () => {
    expect(isModeratorRole("MOD")).toBe(true);
    expect(isModeratorRole("ADMIN")).toBe(true);
    expect(isModeratorRole("TRAVELER")).toBe(false);
    expect(isModeratorRole("RESTAURANT_OWNER")).toBe(false);
    expect(isModeratorRole(undefined)).toBe(false);
  });

  it("offers only the actions that match the report target", () => {
    const restaurant = conclusionActions("restaurant").map((i) => i.value);
    expect(restaurant).toContain("hide_restaurant");
    expect(restaurant).not.toContain("hide_blog");
    const blog = conclusionActions("blog").map((i) => i.value);
    expect(blog).toContain("hide_blog");
    expect(blog).not.toContain("hide_restaurant");
  });

  it("dismisses a report without touching the reported target", async () => {
    const fetchMock = fetchStub({ id: 12, status: "dismissed" });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationReportsService.resolve(12, {
      outcome: "dismissed",
      resolutionAction: "none",
      applyToRelatedReports: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/mod/reports/12/resolve");
    expect(init?.method).toBe("POST");
    // Bác bỏ không được ẩn hay xử phạt đối tượng bị báo cáo.
    expect(JSON.parse(init?.body as string)).toEqual({
      outcome: "dismissed",
      resolutionAction: "none",
      applyToRelatedReports: true,
    });
  });

  it("hides the dismiss button once the report is concluded", () => {
    // Đơn đang mở thì vẫn bác bỏ được.
    expect(isReportOpen("pending")).toBe(true);
    expect(isReportOpen("in_review")).toBe(true);
    expect(canDismissReport("pending")).toBe(true);
    expect(canDismissReport("in_review")).toBe(true);
    // Đơn đã giải quyết hoặc đã bác bỏ thì không còn nút bác bỏ.
    expect(isReportOpen("resolved")).toBe(false);
    expect(isReportOpen("dismissed")).toBe(false);
    expect(canDismissReport("resolved")).toBe(false);
    expect(canDismissReport("dismissed")).toBe(false);
  });

  it("paints the dismissed badge in red, not green", () => {
    expect(reportStatusTone("pending")).toBe("warning");
    expect(reportStatusTone("in_review")).toBe("neutral");
    // Đơn đã giải quyết mới xanh; đơn đã bác bỏ phải đỏ.
    expect(reportStatusTone("resolved")).toBe("success");
    expect(reportStatusTone("dismissed")).toBe("error");
  });
});

describe("MOD-RP service", () => {
  it("lists reports through the same-origin proxy with the target type", async () => {
    const fetchMock = fetchStub({ items: [], totalItems: 0 });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationReportsService.list({
      targetType: "blog",
      status: "pending",
      page: 2,
      pageSize: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/backend/mod/reports?targetType=blog&status=pending&page=2&pageSize=20",
    );
  });

  it("claims and resolves a report with the documented verbs", async () => {
    const fetchMock = fetchStub({ id: 12 });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await moderationReportsService.claim(12);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/mod/reports/12/claim");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");

    await moderationReportsService.resolve(12, {
      outcome: "resolved",
      resolutionAction: "hide_blog",
      applyToRelatedReports: true,
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/backend/mod/reports/12/resolve");
    expect(JSON.parse(init?.body as string)).toEqual({
      outcome: "resolved",
      resolutionAction: "hide_blog",
      applyToRelatedReports: true,
    });
  });
});

describe("OWN-19 and OWN-20 proxy rules", () => {
  it("allows the list and the reply, nothing else", () => {
    expect(
      ownerReviewsOperation("GET", "owner/restaurant/reviews"),
    ).toMatchObject({ body: false, status: 200 });
    expect(
      ownerReviewsOperation("PUT", "owner/restaurant/reviews/42/reply"),
    ).toMatchObject({ body: true, status: 200 });

    for (const [method, path] of [
      ["POST", "owner/restaurant/reviews/42/reply"],
      ["GET", "owner/restaurant/reviews/42"],
      ["DELETE", "owner/restaurant/reviews/42/reply"],
      ["PUT", "owner/restaurant/reviews/abc/reply"],
      ["PUT", "owner/restaurant/reviews/0/reply"],
    ])
      expect(
        ownerReviewsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("OWN-19 and OWN-20 service", () => {
  it("reads the owner reviews with only the filters the backend accepts", async () => {
    const fetchMock = fetchStub({ items: [] });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await ownerReviewsService.list({
      replied: false,
      rating: 5,
      page: 1,
      pageSize: 10,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/backend/owner/restaurant/reviews?replied=false&rating=5&page=1&pageSize=10",
    );
  });

  it("omits the filters that were not chosen", async () => {
    const fetchMock = fetchStub({ items: [] });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await ownerReviewsService.list({});
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/backend/owner/restaurant/reviews",
    );
  });

  it("writes the reply with PUT and the content body", async () => {
    const reply = {
      content: "Cảm ơn bạn!",
      status: "visible",
      createdAt: "",
      updatedAt: "",
    };
    const fetchMock = fetchStub(reply);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ownerReviewsService.reply(42, { content: "Cảm ơn bạn!" }),
    ).resolves.toEqual(reply);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/owner/restaurant/reviews/42/reply");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ content: "Cảm ơn bạn!" });
  });

  it("counts a reply as published only while it is visible", () => {
    const review = (status: string) =>
      ({
        reply: { content: "Cảm ơn bạn!", status, createdAt: "", updatedAt: "" },
      }) as unknown as OwnerReviewDto;
    expect(hasPublishedReply(review("visible"))).toBe(true);
    expect(hasPublishedReply(review("hidden"))).toBe(false);
    expect(hasPublishedReply({ reply: null } as unknown as OwnerReviewDto)).toBe(
      false,
    );
  });
});
