import { describe, expect, it } from "vitest";
import {
  dataId,
  filterFromParam,
  notificationHref,
  notificationsHref,
  notificationTime,
  unreadBadge,
} from "@/features/notifications/notification-rules";

/** NOTI-01..03 helpers: where a notification leads, the list URL, the badge and the time. */
describe("notification destinations", () => {
  it("reads ids written by the backend (snake_case) and by the API Design sample (camelCase)", () => {
    expect(dataId({ blog_id: 45 }, "blog_id")).toBe(45);
    expect(dataId({ blogId: 45 }, "blog_id")).toBe(45);
    expect(dataId({ blog_id: "45" }, "blog_id")).toBe(45);
    expect(dataId({ blog_id: 0 }, "blog_id")).toBeNull();
    expect(dataId({ blog_id: -3 }, "blog_id")).toBeNull();
    expect(dataId({}, "blog_id")).toBeNull();
  });

  it("opens the blog, the roadmap and the restaurant a traveler was told about", () => {
    expect(
      notificationHref(
        { type: "BLOG_COMMENTED", data: { blog_id: 45 } },
        "TRAVELER",
      ),
    ).toBe("/guides/45");
    expect(
      notificationHref(
        { type: "ROADMAP_GENERATED", data: { roadmap_id: 88, job_id: 3 } },
        "TRAVELER",
      ),
    ).toBe("/roadmaps/88");
    expect(
      notificationHref(
        { type: "REVIEW_REPLIED", data: { review_id: 9, restaurant_id: 7 } },
        "TRAVELER",
      ),
    ).toBe("/restaurants/7");
    expect(
      notificationHref({ type: "BLOG_COMMENTED", data: {} }, "TRAVELER"),
    ).toBeNull();
  });

  it("sends an owner to the part of the workspace the decision concerns", () => {
    const owner = (type: string) =>
      notificationHref(
        { type, data: { restaurant_id: 7 } },
        "RESTAURANT_OWNER",
      );
    expect(owner("VERIFICATION_APPROVED")).toBe(
      "/restaurant/verification?tab=status",
    );
    expect(owner("VERIFICATION_NEEDS_MORE_INFO")).toBe(
      "/restaurant/verification?tab=status",
    );
    expect(owner("MENU_REJECTED")).toBe("/restaurant/menu");
    expect(owner("RESTAURANT_REVIEWED")).toBe("/restaurant/reviews");
    expect(owner("RESTAURANT_HIDDEN")).toBe("/restaurant/profile");
  });

  it("keeps informational notifications and owner-only screens unlinked", () => {
    expect(
      notificationHref(
        { type: "REPORT_RESOLVED", data: { report_id: 1 } },
        "TRAVELER",
      ),
    ).toBeNull();
    expect(
      notificationHref(
        { type: "ACCOUNT_SANCTIONED", data: {} },
        "RESTAURANT_OWNER",
      ),
    ).toBeNull();
    expect(
      notificationHref({ type: "MENU_APPROVED", data: {} }, "TRAVELER"),
    ).toBeNull();
  });
});

describe("notification list helpers", () => {
  it("keeps the filter and the page in the URL, defaults left out", () => {
    expect(notificationsHref("", 1)).toBe("/notifications");
    expect(notificationsHref("unread", 1)).toBe("/notifications?filter=unread");
    expect(notificationsHref("unread", 3)).toBe(
      "/notifications?filter=unread&page=3",
    );
    expect(filterFromParam("unread")).toBe("unread");
    expect(filterFromParam("read")).toBe("");
    expect(filterFromParam(null)).toBe("");
  });

  it("caps the badge at three characters", () => {
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(99)).toBe("99");
    expect(unreadBadge(100)).toBe("99+");
  });

  it("says how long ago, then the date after a week", () => {
    const now = Date.parse("2026-10-28T10:00:00Z");
    expect(notificationTime("2026-10-28T09:59:40Z", now)).toBe("Vừa xong");
    expect(notificationTime("2026-10-28T09:55:00Z", now)).toBe("5 phút trước");
    expect(notificationTime("2026-10-28T07:00:00Z", now)).toBe("3 giờ trước");
    expect(notificationTime("2026-10-27T10:00:00Z", now)).toBe("Hôm qua");
    expect(notificationTime("2026-10-10T10:00:00Z", now)).toMatch(/2026/);
    expect(notificationTime("not a date", now)).toBe("");
  });
});
