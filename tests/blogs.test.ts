import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blogError,
  blogFiltersFromParams,
  blogFiltersHref,
  blogProblems,
  blogReportError,
  htmlToText,
  mineHref,
  parseBlogId,
  textToHtml,
} from "@/features/blogs/blog-rules";
import { safeUrl } from "@/features/blogs/blog-content";
import { blogService } from "@/features/blogs/blog-service";
import { ApiError } from "@/shared/api/error";
import { publicOperation } from "@/shared/api/public-proxy";

describe("blog text and HTML", () => {
  it("writes plain text as escaped paragraphs and line breaks", () => {
    expect(textToHtml("Ngày 1\nBún bò\n\nNgày 2")).toBe(
      "<p>Ngày 1<br>Bún bò</p><p>Ngày 2</p>",
    );
    expect(textToHtml('  <script>alert("x")</script> & "ok"  ')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;ok&quot;</p>",
    );
    expect(textToHtml("   \n\n  ")).toBe("");
  });
  it("reads a blog back as the plain text of the editor", () => {
    const text = "Ngày 1\nBún bò <ngon> & rẻ\n\nNgày 2";
    expect(htmlToText(textToHtml(text))).toBe(text);
    expect(
      htmlToText("<h2>Tiêu đề</h2><p>Một<br/>hai</p><ul><li>a</li></ul>"),
    ).toBe("Tiêu đề\n\nMột\nhai\n\na");
  });
  it("needs a title within 255 characters and a content", () => {
    expect(blogProblems("", "")).toEqual({
      title: "Nhập tiêu đề cho cẩm nang.",
      content: "Nhập nội dung cho cẩm nang.",
    });
    expect(blogProblems("a".repeat(256), "x").title).toMatch(/255/);
    expect(blogProblems("Đà Nẵng", "Ngon")).toEqual({});
  });
  it("lets only web and mail links through", () => {
    expect(safeUrl("https://angi.vn/a", ["http", "https"])).toBe(
      "https://angi.vn/a",
    );
    expect(safeUrl("mailto:a@b.vn", ["http", "https", "mailto"])).toBe(
      "mailto:a@b.vn",
    );
    for (const bad of [
      "javascript:alert(1)",
      " JaVaScRiPt:alert(1)",
      "data:text/html;base64,AAAA",
      "vbscript:x",
      "",
      null,
    ])
      expect(safeUrl(bad, ["http", "https"]), String(bad)).toBeNull();
  });
});

describe("blog filters and ids", () => {
  it("reads and writes the list filters", () => {
    const filters = blogFiltersFromParams(
      new URLSearchParams("q=đà nẵng&sort=popular&roadmap=1&page=3"),
    );
    expect(filters).toEqual({
      q: "đà nẵng",
      sort: "popular",
      hasRoadmap: true,
      page: 3,
    });
    expect(
      blogFiltersFromParams(
        new URLSearchParams(blogFiltersHref(filters).split("?")[1]),
      ),
    ).toEqual(filters);
    expect(
      blogFiltersHref(blogFiltersFromParams(new URLSearchParams(""))),
    ).toBe("/guides");
    expect(
      blogFiltersFromParams(new URLSearchParams("sort=x&page=-2")),
    ).toMatchObject({ sort: "newest", page: 1 });
  });
  it("builds the address of my blogs", () => {
    expect(mineHref("", 1)).toBe("/guides/mine");
    expect(mineHref("hidden", 2)).toBe("/guides/mine?status=hidden&page=2");
  });
  it("accepts only positive whole numbers as ids", () => {
    expect(parseBlogId("45")).toBe(45);
    for (const bad of ["0", "-1", "1.5", "abc", "", "mine", "007"])
      expect(parseBlogId(bad), bad).toBeNull();
  });
});

describe("blog errors by errorCode", () => {
  it("names what happened", () => {
    expect(blogError(new ApiError(404, "BLOG_NOT_FOUND", "x"))).toMatchObject({
      gone: true,
    });
    expect(blogError(new ApiError(409, "BLOG_REMOVED", "x")).message).toMatch(
      /đã bị kiểm duyệt viên gỡ/,
    );
    expect(blogError(new ApiError(403, "NOT_OWNER", "x")).message).toMatch(
      /không phải tác giả/,
    );
    expect(
      blogError(new ApiError(404, "ROADMAP_NOT_FOUND", "x")).message,
    ).toMatch(/Lộ trình/);
    expect(
      blogError(new ApiError(503, "SERVICE_UNAVAILABLE", "x")),
    ).toMatchObject({
      gone: false,
    });
  });
  it("settles a report that is already waiting and explains the rest", () => {
    expect(
      blogReportError(new ApiError(409, "REPORT_ALREADY_PENDING", "x")).settled,
    ).toBe(true);
    expect(
      blogReportError(new ApiError(400, "CANNOT_REPORT_OWN_CONTENT", "x")),
    ).toMatchObject({
      settled: false,
      message: expect.stringMatching(/của chính mình/),
    });
    expect(blogReportError(new Error("boom")).settled).toBe(false);
  });
});

describe("blog proxy rules and service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("lets guests read and only a Traveler write", () => {
    for (const path of ["blogs", "blogs/45", "blogs/45/comments"])
      expect(publicOperation("GET", path), path).toMatchObject({
        allowGuest: true,
        status: 200,
      });
    const traveler = (
      method: string,
      path: string,
      status: number,
      body: boolean,
    ) =>
      expect(publicOperation(method, path), `${method} ${path}`).toEqual({
        body,
        status,
        allowGuest: false,
      });
    traveler("POST", "blogs", 201, true);
    traveler("GET", "me/blogs", 200, false);
    traveler("PATCH", "blogs/45", 200, true);
    traveler("DELETE", "blogs/45", 200, false);
    traveler("PUT", "blogs/45/like", 200, false);
    traveler("DELETE", "blogs/45/like", 200, false);
    traveler("POST", "blogs/45/comments", 201, true);
    traveler("DELETE", "blogs/45/comments/302", 200, false);
    traveler("POST", "blogs/45/reports", 201, true);
    for (const [method, path] of [
      ["PUT", "blogs/45"],
      ["POST", "blogs/45"],
      ["POST", "blogs/45/like"],
      ["PUT", "blogs/45/comments"],
      ["DELETE", "blogs"],
      ["GET", "blogs/mine"],
      ["GET", "blogs/0"],
      ["GET", "blogs/45/reports"],
      ["PATCH", "me/blogs"],
      ["DELETE", "blogs/45/comments/0"],
    ])
      expect(publicOperation(method, path), `${method} ${path}`).toBeNull();
  });
  it("calls the blog operations through the same-origin proxy", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: {},
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    await blogService.list({
      q: "đà nẵng",
      sort: "popular",
      page: 2,
      pageSize: 9,
    });
    await blogService.mine({ status: "hidden", page: 1, pageSize: 9 });
    await blogService.like(45);
    await blogService.unlike(45);
    await blogService.edit(45, { title: "Mới", coverMediaId: null });
    await blogService.removeComment(45, 302);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(
      calls.map(([url, init]) => `${init.method ?? "GET"} ${url}`),
    ).toEqual([
      "GET /api/backend/blogs?q=%C4%91%C3%A0+n%E1%BA%B5ng&sort=popular&page=2&pageSize=9",
      "GET /api/backend/me/blogs?status=hidden&page=1&pageSize=9",
      "PUT /api/backend/blogs/45/like",
      "DELETE /api/backend/blogs/45/like",
      "PATCH /api/backend/blogs/45",
      "DELETE /api/backend/blogs/45/comments/302",
    ]);
    // Only the fields that are sent change, and a null cover removes it.
    expect(JSON.parse(calls[4][1].body as string)).toEqual({
      title: "Mới",
      coverMediaId: null,
    });
  });
});
