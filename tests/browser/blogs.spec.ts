import { expect, test, type Page } from "@playwright/test";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";
import type {
  BlogCommentDto,
  BlogDetailDto,
  BlogStatus,
  MyBlogCardDto,
} from "../../src/features/blogs/blog-types";

/**
 * Blogs ("Cẩm nang") against a local stub shaped like the API Design samples: BLOG-01..03 for
 * everybody; BLOG-04..11, BLOG-05, REP-02 and MEDIA-01 for a Traveler. The stub plays the backend's
 * rules: only the author edits or deletes, a removed blog cannot be edited, one report waits at a time.
 * Nothing here reaches Mapbox or a shared backend.
 */
interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  authorized: boolean;
  body: unknown;
}
const me = { id: 12, displayName: "Minh Anh", avatarUrl: null };
const an = { id: 20, displayName: "Nguyễn An", avatarUrl: null };

let calls: Call[] = [];
let blogs: (MyBlogCardDto & {
  authorId: number;
  detail: Partial<BlogDetailDto>;
})[] = [];
let comments: Record<number, BlogCommentDto[]> = {};
let liked = new Set<number>();
let reportState: "ok" | "pending" | "own" = "ok";
let failList = false;
let nextMedia = 9400;
let nextBlog = 100;
let nextComment = 500;

const snapshot = {
  roadmapId: 88,
  title: "3 ngày ăn sập Đà Nẵng",
  startDate: "2026-10-10",
  numDays: 2,
  totalCost: 640000,
  capturedAt: "2026-10-13T10:00:00Z",
  days: [
    {
      dayNumber: 1,
      items: [
        {
          mealSlot: "breakfast" as const,
          dishId: 105,
          dishName: "Bún bò Huế",
          price: 45000,
          restaurantId: 7,
          restaurantName: "Bún Bò Bà Diệu",
          address: "12 Lê Duẩn, Quận Hải Châu",
        },
      ],
    },
    {
      dayNumber: 2,
      items: [
        {
          mealSlot: "dinner" as const,
          dishId: 106,
          dishName: "Mì Quảng",
          price: 40000,
          restaurantId: 8,
          restaurantName: "Mì Quảng Bà Mua",
          address: "19 Trần Bình Trọng",
        },
      ],
    },
  ],
};

function blogOf(
  id: number,
  title: string,
  author: typeof me,
  extra: Partial<MyBlogCardDto & { detail: Partial<BlogDetailDto> }> = {},
) {
  const { detail = {}, ...card } = extra;
  return {
    id,
    title,
    slug: title.toLowerCase().replace(/\s+/g, "-"),
    excerpt: `${title}: ngày đầu tiên mình bắt đầu bằng tô bún bò…`,
    coverUrl: null,
    author,
    hasRoadmap: false,
    likeCount: 3,
    commentCount: 0,
    viewCount: 10,
    publishedAt: `2026-10-${String(30 - (id % 20)).padStart(2, "0")}T10:00:00Z`,
    status: "published" as BlogStatus,
    moderationNote: null,
    authorId: author.id,
    detail,
    ...card,
  };
}

function reset() {
  calls = [];
  failList = false;
  reportState = "ok";
  nextMedia = 9400;
  nextBlog = 100;
  nextComment = 500;
  liked = new Set();
  blogs = [
    blogOf(45, "Hành trình 3 ngày ăn ở Đà Nẵng", an, {
      hasRoadmap: true,
      likeCount: 56,
      commentCount: 2,
      detail: {
        content:
          '<p>Ngày đầu tiên mình ăn <strong>bún bò</strong>.</p><p>Xem thêm <a href="javascript:window.__pwned=1">liên kết xấu</a> và <a href="https://angi.vn/a">liên kết tốt</a>.</p><script>window.__pwned=1</script><p onclick="window.__pwned=1">Đoạn cuối</p>',
        images: ["/assets/figma/coffee.png"],
        roadmapId: 88,
        roadmapSnapshot: snapshot,
      },
    }),
    blogOf(46, "Cà phê trứng ở Hà Nội", me, {
      likeCount: 5,
      detail: {
        content: "<p>Cà phê trứng béo ngậy.</p><p>Nên thử vào buổi sáng.</p>",
        images: ["/assets/figma/coffee.png"],
        coverUrl: "/assets/figma/coffee.png",
      },
      coverUrl: "/assets/figma/coffee.png",
    }),
    blogOf(47, "Bài bị ẩn", me, {
      status: "hidden",
      moderationNote: "Nội dung quảng cáo",
      detail: { content: "<p>Quảng cáo</p>" },
    }),
    blogOf(48, "Bài bị gỡ", me, {
      status: "removed",
      detail: { content: "<p>Đã gỡ</p>" },
    }),
    ...Array.from({ length: 9 }, (_, index) =>
      blogOf(60 + index, `Cẩm nang thêm ${index + 1}`, an, {
        likeCount: index,
        detail: { content: `<p>Nội dung ${index + 1}</p>` },
      }),
    ),
  ];
  comments = {
    45: [
      {
        id: 301,
        blogId: 45,
        user: an,
        content: "Quán này ngon thật!",
        createdAt: "2026-10-13T11:00:00Z",
        isMine: false,
      },
      {
        id: 302,
        blogId: 45,
        user: me,
        content: "Mình cũng thích",
        createdAt: "2026-10-13T12:00:00Z",
        isMine: true,
      },
    ],
  };
}

const publicList = () => blogs.filter((blog) => blog.status === "published");
const asCard = (blog: (typeof blogs)[number]) => {
  const {
    authorId: _a,
    detail: _d,
    status: _s,
    moderationNote: _m,
    ...card
  } = blog;
  void _a;
  void _d;
  void _s;
  void _m;
  return card;
};
const asDetail = (blog: (typeof blogs)[number], signedIn: boolean) => ({
  ...asCard(blog),
  content: "",
  images: [],
  roadmapId: null,
  roadmapSnapshot: null,
  ...blog.detail,
  likedByMe: signedIn && liked.has(blog.id),
  isMine: signedIn && blog.authorId === me.id,
  updatedAt: "2026-10-13T10:00:00Z",
});
const paged = <T>(items: T[], params: URLSearchParams) => {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "20");
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
};

const handler: StubHandler = ({ method, url, body, headers }, send) => {
  const rest = url.replace("/api/v1/", "");
  const [path, query = ""] = rest.split("?");
  const params = new URLSearchParams(query);
  const signedIn = Boolean(headers.authorization);
  if (!/^(blogs|me\/blogs|media|roadmaps)(\/|$)/.test(path)) return false;
  calls.push({ method, path, query: params, authorized: signedIn, body });
  const requireAuth = () => {
    if (signedIn) return true;
    send(401, null, "UNAUTHORIZED");
    return false;
  };

  if (method === "GET" && path === "roadmaps") {
    send(200, {
      items: [
        { id: 88, title: "3 ngày ăn sập Đà Nẵng", numDays: 3, itemCount: 9 },
        { id: 89, title: "Cuối tuần ở Hà Nội", numDays: 2, itemCount: 4 },
      ],
      page: 1,
      pageSize: 50,
      totalItems: 2,
      totalPages: 1,
    });
    return true;
  }
  if (method === "GET" && path === "blogs") {
    if (failList) {
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    const q = (params.get("q") ?? "").toLowerCase();
    let items = publicList().filter((blog) =>
      blog.title.toLowerCase().includes(q),
    );
    if (params.get("hasRoadmap") === "true")
      items = items.filter((blog) => blog.hasRoadmap);
    items = [...items].sort((a, b) =>
      params.get("sort") === "popular"
        ? b.likeCount + b.commentCount - (a.likeCount + a.commentCount)
        : b.publishedAt.localeCompare(a.publishedAt),
    );
    send(200, paged(items.map(asCard), params));
    return true;
  }
  if (method === "GET" && path === "me/blogs") {
    if (!requireAuth()) return true;
    const status = params.get("status");
    const items = blogs.filter(
      (blog) => blog.authorId === me.id && (!status || blog.status === status),
    );
    send(
      200,
      paged(
        items.map(({ authorId: _a, detail: _d, ...card }) => {
          void _a;
          void _d;
          return card;
        }),
        params,
      ),
    );
    return true;
  }
  if (method === "POST" && path === "blogs") {
    if (!requireAuth()) return true;
    const sent = body as {
      title: string;
      content: string;
      coverMediaId?: number;
      roadmapId?: number;
    };
    if (!sent.title || !sent.content) {
      send(400, null, "VALIDATION_FAILED");
      return true;
    }
    nextBlog += 1;
    const created = blogOf(nextBlog, sent.title, me, {
      hasRoadmap: Boolean(sent.roadmapId),
      detail: {
        content: sent.content,
        roadmapId: sent.roadmapId ?? null,
        roadmapSnapshot: sent.roadmapId ? snapshot : null,
      },
    });
    blogs = [created, ...blogs];
    send(201, asDetail(created, true));
    return true;
  }
  const one = /^blogs\/(\d+)(?:\/(comments|like|reports)(?:\/(\d+))?)?$/.exec(
    path,
  );
  if (!one) return false;
  const id = Number(one[1]);
  const blog = blogs.find((entry) => entry.id === id);
  const visible =
    blog &&
    (blog.status === "published" || (signedIn && blog.authorId === me.id));
  if (!blog || (!visible && method === "GET")) {
    send(404, null, "BLOG_NOT_FOUND");
    return true;
  }
  const part = one[2];
  if (method === "GET" && !part) {
    send(200, asDetail(blog, signedIn));
    return true;
  }
  if (method === "GET" && part === "comments") {
    send(200, paged(comments[id] ?? [], params));
    return true;
  }
  if (!requireAuth()) return true;
  // Like and unlike are idempotent: repeating them does not change the count again.
  if (method === "PUT" && part === "like") {
    if (!liked.has(id)) blog.likeCount += 1;
    liked.add(id);
    send(200, { liked: true, likeCount: blog.likeCount });
    return true;
  }
  if (method === "DELETE" && part === "like") {
    if (liked.has(id)) blog.likeCount -= 1;
    liked.delete(id);
    send(200, { liked: false, likeCount: blog.likeCount });
    return true;
  }
  if (method === "POST" && part === "comments") {
    const content = (body as { content: string }).content;
    nextComment += 1;
    const comment: BlogCommentDto = {
      id: nextComment,
      blogId: id,
      user: me,
      content,
      createdAt: "2026-10-26T02:00:00Z",
      isMine: true,
    };
    comments[id] = [...(comments[id] ?? []), comment];
    send(201, comment);
    return true;
  }
  if (method === "DELETE" && part === "comments") {
    const comment = (comments[id] ?? []).find(
      (entry) => entry.id === Number(one[3]),
    );
    if (!comment) send(404, null, "COMMENT_NOT_FOUND");
    else if (!comment.isMine) send(403, null, "NOT_OWNER");
    else {
      comments[id] = comments[id].filter((entry) => entry.id !== comment.id);
      send(200, null);
    }
    return true;
  }
  if (method === "POST" && part === "reports") {
    if (reportState === "pending") send(409, null, "REPORT_ALREADY_PENDING");
    else if (reportState === "own" || blog.authorId === me.id)
      send(400, null, "CANNOT_REPORT_OWN_CONTENT");
    else send(201, { reportId: 89, status: "pending" });
    return true;
  }
  if (method === "PATCH" && !part) {
    if (blog.authorId !== me.id) send(403, null, "NOT_OWNER");
    else if (blog.status === "removed") send(409, null, "BLOG_REMOVED");
    else {
      const sent = body as {
        title?: string;
        content?: string;
        coverMediaId?: number | null;
      };
      if (sent.title !== undefined) blog.title = sent.title;
      if (sent.content !== undefined) blog.detail.content = sent.content;
      if (sent.coverMediaId === null) {
        blog.coverUrl = null;
        blog.detail.coverUrl = null;
      }
      send(200, asDetail(blog, true));
    }
    return true;
  }
  if (method === "DELETE" && !part) {
    if (blog.authorId !== me.id) send(403, null, "NOT_OWNER");
    else {
      blogs = blogs.filter((entry) => entry.id !== id);
      send(200, null);
    }
    return true;
  }
  return false;
};
const mediaHandler: StubHandler = (request, send) => {
  if (request.method === "POST" && request.url === "/api/v1/media") {
    calls.push({
      method: "POST",
      path: "media",
      query: new URLSearchParams(),
      authorized: Boolean(request.headers.authorization),
      body: request.body,
    });
    nextMedia += 1;
    send(201, {
      id: nextMedia,
      url: "/assets/figma/coffee.png",
      mimeType: "image/png",
      sizeBytes: 68,
      purpose: String(request.body).includes("report_evidence")
        ? "report_evidence"
        : "blog",
      createdAt: "2026-10-26T02:00:00Z",
    });
    return true;
  }
  return handler(request, send);
};

let stub: AccountStub;
test.beforeAll(async () => {
  stub = await startAccountStub(5164, mediaHandler);
});
test.afterAll(async () => {
  await stopAccountStub(stub);
});
test.beforeEach(async ({ page }) => {
  stub.reset();
  reset();
  await page.setViewportSize({ width: 1440, height: 1800 });
});

const callsTo = (method: string, path: string) =>
  calls.filter((entry) => entry.method === method && entry.path === path);
const cards = (page: Page) => page.locator(".blog-card, .blog-lead, .blog-row");
const publicCards = (page: Page) => page.locator(".blog-card");
const cardOf = (page: Page, title: string) =>
  cards(page).filter({
    has: page.getByRole("link", { name: title, exact: true }),
  });
const publicCardOf = (page: Page, title: string) =>
  publicCards(page).filter({
    has: page.getByRole("link", { name: title, exact: true }),
  });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("public list", () => {
  test("a guest reads the list: BLOG-01 without a token and the nav shows the place", async ({
    page,
  }) => {
    await page.goto("/guides");
    await expect(
      page.getByRole("heading", { name: "Cẩm nang ẩm thực", level: 1 }),
    ).toBeVisible();
    // Only published blogs, nine per page.
    await expect(cards(page)).toHaveCount(9);
    await expect(
      page
        .getByRole("navigation", { name: "Điều hướng chính" })
        .getByRole("link", { name: "Cẩm nang" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("link", { name: "Đăng nhập để viết cẩm nang" }),
    ).toBeVisible();
    const call = callsTo("GET", "blogs")[0];
    expect(call.authorized).toBe(false);
    expect(call.query.get("pageSize")).toBe("9");
    await expect(page.getByText(/^11 bài, mới nhất ngày/)).toBeVisible();
  });

  test("the three-dot menu of a card reports the blog (REP-02)", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides");
    const card = publicCardOf(page, "Hành trình 3 ngày ăn ở Đà Nẵng");
    // The menu is closed until the round button is pressed.
    await expect(card.getByRole("menu")).toHaveCount(0);
    await card.getByRole("button", { name: /Tuỳ chọn cho bài/ }).click();
    await expect(card.getByRole("menu")).toBeVisible();
    await card.getByRole("menuitem", { name: "Báo cáo bài viết" }).click();
    const box = page.getByRole("dialog", { name: "Báo cáo bài viết" });
    await expect(box).toBeVisible();
    await box.getByLabel("Nội dung rác hoặc quảng cáo").check();
    await box.getByRole("button", { name: "Gửi báo cáo" }).click();
    await expect(box).toBeHidden();
    expect(callsTo("POST", "blogs/45/reports")).toHaveLength(1);
    await expect(page.getByText("Đã gửi báo cáo.")).toBeVisible();
  });

  test("a guest is asked to sign in instead of being offered a report", async ({
    page,
  }) => {
    await page.goto("/guides");
    const card = publicCardOf(page, "Hành trình 3 ngày ăn ở Đà Nẵng");
    await card.getByRole("button", { name: /Tuỳ chọn cho bài/ }).click();
    await expect(card.getByText("Đăng nhập để báo cáo bài viết này.")).toBeVisible();
    await expect(
      card.getByRole("menuitem", { name: "Báo cáo bài viết" }),
    ).toHaveCount(0);
  });

  test("search, sort and the roadmap filter live in the URL and reach BLOG-01", async ({
    page,
  }) => {
    await page.goto("/guides");
    await page.getByRole("searchbox", { name: "Tìm cẩm nang" }).fill("đà nẵng");
    await page.getByRole("button", { name: "Tìm cẩm nang" }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cardOf(page, "Hành trình 3 ngày ăn ở Đà Nẵng")).toContainText(
      "Có lịch ăn đính kèm",
    );
    expect(callsTo("GET", "blogs").at(-1)!.query.get("q")).toBe("đà nẵng");
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(cards(page)).toHaveCount(9);
    await page.getByLabel("Sắp xếp").selectOption("popular");
    await page.getByLabel("Chỉ bài có lịch ăn đính kèm").check();
    await page.getByRole("button", { name: "Tìm cẩm nang" }).click();
    await expect(page).toHaveURL(/sort=popular/);
    await expect(page).toHaveURL(/roadmap=1/);
    const last = callsTo("GET", "blogs").at(-1)!;
    expect(last.query.get("sort")).toBe("popular");
    expect(last.query.get("hasRoadmap")).toBe("true");
  });

  test("pages come from the URL and a page past the end falls back", async ({
    page,
  }) => {
    await page.goto("/guides");
    await page.getByRole("button", { name: "Trang sau" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page)).toHaveCount(2);
    await page.goto("/guides?page=9");
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page)).toHaveCount(2);
  });

  test("a failed list can be retried", async ({ page }) => {
    failList = true;
    await page.goto("/guides");
    await expect(
      page.getByRole("heading", { name: "Chưa tải được cẩm nang" }),
    ).toBeVisible();
    failList = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(cards(page)).toHaveCount(9);
  });

  test("a signed-in traveler gets the write and my-blogs buttons and the account menu", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    calls = [];
    await page.goto("/guides");
    await expect(
      page.getByRole("link", { name: "Viết cẩm nang" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Bài viết của tôi" }).first(),
    ).toBeVisible();
    expect(callsTo("GET", "blogs")[0].authorized).toBe(true);
    await page.locator("summary[aria-label^='Tài khoản']").click();
    await expect(
      page.getByRole("link", { name: "Bài viết của tôi" }).last(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Viết cẩm nang" }).last(),
    ).toBeVisible();
  });
});

test.describe("detail", () => {
  test("a guest reads the blog: only safe markup is shown, the roadmap and the comments", async ({
    page,
  }) => {
    await page.goto("/guides/45");
    await expect(
      page.getByRole("heading", {
        name: "Hành trình 3 ngày ăn ở Đà Nẵng",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.locator(".blog-content strong")).toHaveText("bún bò");
    await expect(page.getByText("Đoạn cuối")).toBeVisible();
    // Scripts and handlers from the content never run; a javascript: link is not a link.
    expect(
      await page.evaluate(
        () => (window as unknown as { __pwned?: number }).__pwned,
      ),
    ).toBeUndefined();
    await page.getByText("Đoạn cuối").click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __pwned?: number }).__pwned,
      ),
    ).toBeUndefined();
    await expect(page.getByRole("link", { name: "liên kết xấu" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: "liên kết tốt" }),
    ).toHaveAttribute("href", "https://angi.vn/a");
    expect(callsTo("GET", "blogs/45")[0].authorized).toBe(false);
    // Roadmap snapshot (days as tabs).
    const aside = page.locator(".blog-aside");
    await expect(aside).toContainText("3 ngày ăn sập Đà Nẵng");
    await expect(aside).toContainText("Bún bò Huế");
    await aside.getByRole("tab", { name: "Ngày 2" }).click();
    await expect(aside).toContainText("Mì Quảng");
    await expect(
      aside.getByRole("link", { name: "Mì Quảng Bà Mua" }),
    ).toHaveAttribute("href", "/restaurants/8");
    // Comments are readable; writing asks to sign in.
    await expect(page.getByText("Quán này ngon thật!")).toBeVisible();
    await expect(page.getByText("Bình luận · 2")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gửi bình luận" }),
    ).toHaveCount(0);
    await expect(page.getByText("để bình luận")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thích/ })).toHaveCount(0);
  });

  test("a blog that is not there says so", async ({ page }) => {
    await page.goto("/guides/999");
    await expect(
      page.getByRole("heading", { name: "Bài viết không còn khả dụng" }),
    ).toBeVisible();
    await page.goto("/guides/abc");
    await expect(
      page.getByRole("heading", { name: "Trang này chưa có" }),
    ).toBeVisible();
  });

  test("a traveler likes and unlikes (BLOG-08/09) with the server's count", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/45");
    const like = page.getByRole("button", { name: /Thích/ });
    await expect(like).toHaveText(/Thích · 56/);
    await like.click();
    await expect(page.getByRole("button", { name: /Đã thích/ })).toHaveText(
      /Đã thích · 57/,
    );
    expect(callsTo("PUT", "blogs/45/like")).toHaveLength(1);
    await page.getByRole("button", { name: /Đã thích/ }).click();
    await expect(page.getByRole("button", { name: /Thích/ })).toHaveText(
      /Thích · 56/,
    );
    expect(callsTo("DELETE", "blogs/45/like")).toHaveLength(1);
  });

  test("a traveler comments (BLOG-10) and deletes their own comment (BLOG-11)", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/45");
    await page.getByRole("button", { name: "Gửi bình luận" }).click();
    await expect(page.getByText("Nhập nội dung bình luận.")).toBeVisible();
    expect(callsTo("POST", "blogs/45/comments")).toHaveLength(0);
    await page.getByLabel("Bình luận của bạn").fill("Cảm ơn bạn đã chia sẻ");
    await page.getByRole("button", { name: "Gửi bình luận" }).click();
    await expect(page.getByText("Cảm ơn bạn đã chia sẻ")).toBeVisible();
    expect(callsTo("POST", "blogs/45/comments")[0].body).toEqual({
      content: "Cảm ơn bạn đã chia sẻ",
    });
    await expect(page.getByText("Bình luận · 3")).toBeVisible();
    // Only my own comments have the delete button.
    await expect(
      page.getByRole("button", { name: "Xóa bình luận của tôi" }),
    ).toHaveCount(2);
    await page
      .getByRole("button", { name: "Xóa bình luận của tôi" })
      .first()
      .click();
    const box = page.getByRole("dialog", { name: "Xóa bình luận?" });
    await box.getByRole("button", { name: "Giữ lại" }).click();
    expect(callsTo("DELETE", "blogs/45/comments/302")).toHaveLength(0);
    await page
      .getByRole("button", { name: "Xóa bình luận của tôi" })
      .first()
      .click();
    await box.getByRole("button", { name: "Xóa bình luận" }).click();
    await expect(page.getByText("Mình cũng thích")).toHaveCount(0);
    await expect(page.getByText("Bình luận · 2")).toBeVisible();
    expect(callsTo("DELETE", "blogs/45/comments/302")).toHaveLength(1);
  });

  test("a traveler reports a blog (REP-02) with evidence; a waiting report is explained", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/45");
    await page.getByRole("button", { name: "Báo cáo bài viết" }).click();
    const box = page.getByRole("dialog", { name: "Báo cáo bài viết" });
    await box.getByLabel("Lý do khác").check();
    await box.getByRole("button", { name: "Gửi báo cáo" }).click();
    await expect(box.getByText(/Hãy mô tả lý do/)).toBeVisible();
    await box.getByLabel("Nội dung rác hoặc quảng cáo").check();
    await box.getByLabel(/^Mô tả chi tiết/).fill("Bài quảng cáo trá hình");
    await box.getByLabel("Ảnh bằng chứng").setInputFiles({
      name: "bang-chung.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(
      box.getByRole("button", { name: "Bỏ ảnh bang-chung.png" }),
    ).toBeVisible();
    await box.getByRole("button", { name: "Gửi báo cáo" }).click();
    await expect(box).toBeHidden();
    expect(callsTo("POST", "blogs/45/reports")[0].body).toEqual({
      reasonCode: "spam",
      description: "Bài quảng cáo trá hình",
      evidenceMediaIds: [9401],
    });
    await expect(page.getByText("Đã gửi báo cáo.")).toBeVisible();
    reportState = "pending";
    await page.getByRole("button", { name: "Báo cáo bài viết" }).click();
    await page
      .getByRole("dialog", { name: "Báo cáo bài viết" })
      .getByRole("button", { name: "Gửi báo cáo" })
      .click();
    await expect(
      page.getByText(
        "Báo cáo trước đó của bạn về bài viết này đang chờ xử lý.",
      ),
    ).toBeVisible();
  });

  test("the author edits or deletes their blog and cannot report it", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/46");
    await expect(page.getByRole("link", { name: "Chỉnh sửa" })).toHaveAttribute(
      "href",
      "/guides/46/edit",
    );
    await expect(
      page.getByRole("button", { name: "Báo cáo bài viết" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Xóa bài viết" }).click();
    const box = page.getByRole("dialog", { name: "Xóa bài viết này?" });
    await box.getByRole("button", { name: "Xóa bài viết" }).click();
    await expect(page).toHaveURL(/\/guides\/mine$/);
    expect(callsTo("DELETE", "blogs/46")).toHaveLength(1);
    await expect(cardOf(page, "Cà phê trứng ở Hà Nội")).toHaveCount(0);
  });

  test("an owner of a restaurant reads without like, comment or report", async ({
    page,
  }) => {
    await loginAs(page, "owner");
    await page.goto("/guides/45");
    await expect(
      page.getByRole("heading", {
        name: "Hành trình 3 ngày ăn ở Đà Nẵng",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByText("56 lượt thích")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Báo cáo bài viết" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Gửi bình luận" }),
    ).toHaveCount(0);
  });
});

test.describe("my blogs", () => {
  test("lists mine with their status; statuses are tabs (BLOG-05)", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/mine");
    await expect(
      page.getByRole("heading", { name: "Bài viết của tôi", level: 1 }),
    ).toBeVisible();
    await expect(cards(page)).toHaveCount(3);
    await expect(cardOf(page, "Bài bị ẩn")).toContainText("Đã bị ẩn");
    await expect(cardOf(page, "Bài bị ẩn")).toContainText(
      "Lý do kiểm duyệt: Nội dung quảng cáo",
    );
    await expect(cardOf(page, "Bài bị gỡ")).toContainText("Đã bị gỡ");
    // A removed blog cannot be edited, only deleted.
    await expect(
      cardOf(page, "Bài bị gỡ").getByRole("link", {
        name: "Chỉnh sửa bài Bài bị gỡ",
      }),
    ).toHaveCount(0);
    await expect(
      cardOf(page, "Cà phê trứng ở Hà Nội").getByRole("link", {
        name: "Chỉnh sửa bài Cà phê trứng ở Hà Nội",
      }),
    ).toBeVisible();
    // The status sits on the line under the title; the excerpt is not shown here.
    await expect(cardOf(page, "Bài bị ẩn").locator(".blog-row-status")).toHaveText(
      "Đã bị ẩn",
    );
    await expect(
      cardOf(page, "Bài bị ẩn").locator(".blog-excerpt"),
    ).toHaveCount(0);
    // The two icons hide until the pointer is over the card.
    const actions = cardOf(page, "Bài bị ẩn").locator(".blog-row-actions");
    await expect(actions).toHaveCSS("opacity", "0");
    await cardOf(page, "Bài bị ẩn").hover();
    await expect(actions).toHaveCSS("opacity", "1");
    await page.getByRole("tab", { name: "Đã bị ẩn" }).click();
    await expect(page).toHaveURL(/status=hidden/);
    await expect(cards(page)).toHaveCount(1);
    expect(callsTo("GET", "me/blogs").at(-1)!.query.get("status")).toBe(
      "hidden",
    );
  });

  test("deleting asks first, then sends BLOG-07 and refreshes the list", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/mine");
    await page.getByRole("button", { name: "Xóa bài Bài bị ẩn" }).click();
    const box = page.getByRole("dialog", { name: "Xóa bài viết này?" });
    await box.getByRole("button", { name: "Giữ lại" }).click();
    expect(callsTo("DELETE", "blogs/47")).toHaveLength(0);
    await page.getByRole("button", { name: "Xóa bài Bài bị ẩn" }).click();
    await box.getByRole("button", { name: "Xóa bài viết" }).click();
    await expect(page.getByText("Đã xóa “Bài bị ẩn”.")).toBeVisible();
    await expect(cards(page)).toHaveCount(2);
    expect(callsTo("DELETE", "blogs/47")).toHaveLength(1);
  });

  test("a guest is sent to sign in", async ({ page }) => {
    await page.goto("/guides/mine");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("editor", () => {
  test("a new blog needs a title and content, uploads its photos and sends BLOG-04", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/new");
    await page.getByRole("button", { name: "Đăng cẩm nang" }).click();
    await expect(page.getByText("Nhập tiêu đề cho cẩm nang.")).toBeVisible();
    await expect(page.getByText("Nhập nội dung cho cẩm nang.")).toBeVisible();
    expect(callsTo("POST", "blogs")).toHaveLength(0);
    await page.getByLabel("Tiêu đề").fill("Một ngày ở Huế");
    await page
      .getByLabel("Nội dung")
      .fill("Sáng ăn bún bò <ngon>\nTrưa ăn cơm hến\n\nTối ăn bánh bèo");
    await page
      .getByLabel("Ảnh bìa · Không bắt buộc")
      .setInputFiles({ name: "bia.png", mimeType: "image/png", buffer: png });
    await expect(
      page.getByRole("button", { name: "Bỏ ảnh bia.png" }),
    ).toBeVisible();
    await page.getByLabel("Ảnh trong bài · Không bắt buộc").setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: png },
      { name: "b.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(
      page.getByRole("button", { name: "Bỏ ảnh b.png" }),
    ).toBeVisible();
    expect(String(callsTo("POST", "media")[0].body)).toContain("blog");
    await page
      .getByLabel(/Không bắt buộc · chọn một lộ trình/)
      .selectOption("88");
    await page.getByRole("button", { name: "Đăng cẩm nang" }).click();
    await expect(page).toHaveURL(/\/guides\/101$/);
    expect(callsTo("POST", "blogs")[0].body).toEqual({
      title: "Một ngày ở Huế",
      content:
        "<p>Sáng ăn bún bò &lt;ngon&gt;<br>Trưa ăn cơm hến</p><p>Tối ăn bánh bèo</p>",
      coverMediaId: 9401,
      imageMediaIds: [9402, 9403],
      roadmapId: 88,
    });
    await expect(
      page.getByRole("heading", { name: "Một ngày ở Huế", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".blog-aside")).toContainText(
      "3 ngày ăn sập Đà Nẵng",
    );
  });

  test("“Chia sẻ lộ trình” opens the editor with the roadmap chosen", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/new?roadmap=89");
    await expect(
      page.getByLabel(/Không bắt buộc · chọn một lộ trình/),
    ).toHaveValue("89");
    await page.getByLabel("Tiêu đề").fill("Cuối tuần ở Hà Nội");
    await page.getByLabel("Nội dung").fill("Đi ăn phở");
    await page.getByRole("button", { name: "Đăng cẩm nang" }).click();
    await expect(page).toHaveURL(/\/guides\/101$/);
    expect(callsTo("POST", "blogs")[0].body).toMatchObject({ roadmapId: 89 });
  });

  test("leaving with unsent edits asks first", async ({ page }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/new");
    await page.getByLabel("Tiêu đề").fill("Chưa đăng");
    await page.getByRole("link", { name: "ANGI" }).first().click();
    const box = page.getByRole("dialog", { name: "Rời trang khi chưa đăng?" });
    await expect(box).toBeVisible();
    await box.getByRole("button", { name: "Ở lại" }).click();
    await expect(page).toHaveURL(/\/guides\/new$/);
    await expect(page.getByLabel("Tiêu đề")).toHaveValue("Chưa đăng");
    await page.getByRole("button", { name: "Hủy" }).click();
    await box.getByRole("button", { name: "Rời trang" }).click();
    await expect(page).toHaveURL(/\/guides$/);
  });

  test("editing sends only what changed (BLOG-06) and the author sees the plain text", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/46/edit");
    await expect(page.getByLabel("Tiêu đề")).toHaveValue(
      "Cà phê trứng ở Hà Nội",
    );
    await expect(page.getByLabel("Nội dung")).toHaveValue(
      "Cà phê trứng béo ngậy.\n\nNên thử vào buổi sáng.",
    );
    // Nothing changed: nothing is sent.
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page).toHaveURL(/\/guides\/46$/);
    expect(callsTo("PATCH", "blogs/46")).toHaveLength(0);
    await page.goto("/guides/46/edit");
    await page.getByLabel("Tiêu đề").fill("Cà phê trứng ngon nhất");
    await page.getByRole("button", { name: "Bỏ ảnh bìa" }).click();
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page).toHaveURL(/\/guides\/46$/);
    expect(callsTo("PATCH", "blogs/46")[0].body).toEqual({
      title: "Cà phê trứng ngon nhất",
      coverMediaId: null,
    });
    await expect(
      page.getByRole("heading", { name: "Cà phê trứng ngon nhất", level: 1 }),
    ).toBeVisible();
  });

  test("a blog that moderators removed cannot be saved, and someone else's cannot be edited", async ({
    page,
  }) => {
    await loginAs(page, "traveler");
    await page.goto("/guides/48/edit");
    await page.getByLabel("Tiêu đề").fill("Sửa bài đã gỡ");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(
      page.getByText("Bài viết đã bị kiểm duyệt viên gỡ nên không sửa được."),
    ).toBeVisible();
    await page.goto("/guides/45/edit");
    await expect(
      page.getByRole("heading", {
        name: "Bạn không có bài viết này để chỉnh sửa",
      }),
    ).toBeVisible();
  });
});

test("the pages fit from 320px to 1440px", async ({ page }) => {
  await loginAs(page, "traveler");
  for (const path of [
    "/guides",
    "/guides/45",
    "/guides/mine",
    "/guides/new",
    "/guides/46/edit",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1800 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} ${width}px`,
      ).toBe(true);
    }
  }
});
