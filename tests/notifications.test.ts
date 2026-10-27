import { afterEach, describe, expect, it, vi } from "vitest";
import { notificationOperation } from "@/shared/api/notification-proxy";
import {
  createLiveNotificationService,
  createMockNotificationService,
} from "@/api/services/notification-service";
import {
  notificationDestination,
  toNotificationItem,
  toNotificationList,
  type NotificationWireDto,
} from "@/api/services/notification-types";

describe("notification proxy rules", () => {
  it("allows exactly the three NOTI operations", () => {
    expect(notificationOperation("GET", "me/notifications")).toEqual({
      body: false,
      status: 200,
    });
    expect(
      notificationOperation("GET", "me/notifications/unread-count"),
    ).toEqual({ body: false, status: 200 });
    // NOTI-03 answers 200 OK, not 201.
    expect(notificationOperation("POST", "me/notifications/read")).toEqual({
      body: true,
      status: 200,
    });
  });
  it("rejects every other method and path", () => {
    for (const [method, path] of [
      ["GET", "me/notifications/read"],
      ["POST", "me/notifications"],
      ["POST", "me/notifications/unread-count"],
      ["GET", "me/notifications/12"],
      ["DELETE", "me/notifications/read"],
      ["PUT", "me/notifications/read"],
      ["GET", "me/notificationsx"],
      ["GET", "me"],
      ["GET", "notifications"],
    ])
      expect(
        notificationOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});

describe("notification wire mapping", () => {
  const wire = (
    overrides: Partial<NotificationWireDto> = {},
  ): NotificationWireDto => ({
    id: 5,
    type: "BLOG_COMMENTED",
    title: "Có bình luận mới",
    body: 'Minh Anh: "ngon"',
    data: { blog_id: 12 },
    readAt: null,
    createdAt: "2026-10-20T08:30:00Z",
    ...overrides,
  });

  it("maps readAt to the read flag and keeps null bodies readable", () => {
    expect(toNotificationItem(wire())).toMatchObject({
      id: 5,
      title: "Có bình luận mới",
      body: 'Minh Anh: "ngon"',
      read: false,
      kind: "social",
      destination: "guides/12",
    });
    expect(
      toNotificationItem(wire({ readAt: "2026-10-20T09:00:00Z", body: null })),
    ).toMatchObject({ read: true, body: "" });
  });
  it("routes each backend type to an existing workspace screen", () => {
    expect(notificationDestination("VERIFICATION_APPROVED", null)).toBe(
      "verification",
    );
    expect(notificationDestination("MENU_REJECTED", null)).toBe("menu");
    expect(
      notificationDestination("ROADMAP_GENERATED", { roadmap_id: 3 }),
    ).toBe("roadmaps/3");
    expect(
      notificationDestination("REVIEW_REPLIED", { restaurant_id: 7 }),
    ).toBe("restaurants/7");
  });
  it("leaves the destination unset when the backend sends no id", () => {
    expect(notificationDestination("BLOG_COMMENTED", null)).toBeUndefined();
    expect(
      notificationDestination("BLOG_COMMENTED", { blog_id: 0 }),
    ).toBeUndefined();
    expect(
      notificationDestination("BLOG_COMMENTED", { blog_id: "12" }),
    ).toBeUndefined();
    expect(notificationDestination("ACCOUNT_SANCTIONED", null)).toBeUndefined();
  });
  it("maps the paged response without losing the counters", () => {
    const result = toNotificationList({
      items: [wire()],
      page: 2,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
      unreadCount: 4,
    });
    expect(result).toMatchObject({
      page: 2,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
      unreadCount: 4,
    });
    expect(result.items).toHaveLength(1);
  });
});

describe("live notification service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the documented query, path and body", async () => {
    const fetchMock = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: url.includes("unread-count")
              ? { unreadCount: 6 }
              : {
                  items: [
                    {
                      id: 9,
                      type: "MENU_APPROVED",
                      title: "Menu đã được duyệt",
                      body: null,
                      data: { restaurant_id: 4 },
                      readAt: null,
                      createdAt: "2026-10-20T08:30:00Z",
                    },
                  ],
                  page: 1,
                  pageSize: 10,
                  totalItems: 1,
                  totalPages: 1,
                  unreadCount: 1,
                },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = createLiveNotificationService(fetchMock as never);

    await service.list({ page: 2, pageSize: 10, read: false });
    await service.unreadCount();
    await service.markRead({ notificationIds: [9, 10] });
    await service.markRead({ markAll: true });

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "/api/backend/me/notifications?page=2&pageSize=10&isRead=false",
      "/api/backend/me/notifications/unread-count",
      "/api/backend/me/notifications/read",
      "/api/backend/me/notifications/read",
    ]);
    expect(calls[2][1].method).toBe("POST");
    expect(JSON.parse(calls[2][1].body as string)).toEqual({ ids: [9, 10] });
    expect(JSON.parse(calls[3][1].body as string)).toEqual({ all: true });
  });

  it("maps a live item into the view model", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data: {
              items: [
                {
                  id: 3,
                  type: "ROADMAP_GENERATED",
                  title: "Roadmap đã được tạo xong",
                  body: "AI đã thêm 4 món.",
                  data: { roadmap_id: 77, job_id: 2 },
                  readAt: "2026-10-20T09:00:00Z",
                  createdAt: "2026-10-20T08:30:00Z",
                },
              ],
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
              unreadCount: 0,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const service = createLiveNotificationService(fetchMock as never);
    const result = await service.list();
    expect(result.items[0]).toMatchObject({
      id: 3,
      read: true,
      kind: "roadmap",
      destination: "roadmaps/77",
    });
  });

  it("fails loudly when the backend answers an error", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            message: "Endpoint chưa được cấu hình.",
            errorCode: "ROUTE_NOT_FOUND",
            data: null,
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        ),
    );
    const service = createLiveNotificationService(fetchMock as never);
    await expect(service.list()).rejects.toThrow();
    await expect(service.unreadCount()).rejects.toThrow();
  });
});

describe("mock notification service", () => {
  it("paginates, filters and marks notifications as read", async () => {
    const service = createMockNotificationService();
    const all = await service.list({ page: 1, pageSize: 10 });
    expect(all.totalItems).toBe(10);
    expect(all.unreadCount).toBe(5);

    const unread = await service.list({ page: 1, pageSize: 10, read: false });
    expect(unread.items.every((n) => !n.read)).toBe(true);

    const id = unread.items[0].id;
    await expect(
      service.markRead({ notificationIds: [id] }),
    ).resolves.toMatchObject({ updated: 1 });
    const after = await service.list({ page: 1, pageSize: 10, read: false });
    expect(after.items.some((n) => n.id === id)).toBe(false);
  });
});
