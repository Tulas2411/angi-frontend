import { describe, expect, it } from "vitest";
import {
  activeAuditFilters,
  auditActions,
  auditAgent,
  auditChanges,
  auditDay,
  auditEntityLabel,
  auditEntityTypes,
  auditError,
  auditFilterProblems,
  auditQuery,
  auditQueryString,
  auditReason,
  auditValueText,
  emptyAuditFilters,
} from "@/features/admin/audit-rules";
import { adminAuditOperation } from "@/shared/api/admin-proxy";
import { ApiError } from "@/shared/api/error";

describe("F-64 audit log catalog", () => {
  it("knows every action and entity type of API Design v1.8 (sheet Enum)", () => {
    expect(Object.keys(auditActions)).toEqual([
      "USER_REGISTERED",
      "USER_LOGIN",
      "PASSWORD_RESET",
      "PROFILE_UPDATED",
      "PASSWORD_CHANGED",
      "RESTAURANT_UPDATED",
      "RESTAURANT_OPERATING_STATUS_CHANGED",
      "USER_WARNED",
      "USER_SUSPENDED",
      "USER_BANNED",
      "USER_UNBANNED",
      "RESTAURANT_HIDDEN",
      "RESTAURANT_SUSPENDED",
      "RESTAURANT_SHOWN",
      "RESTAURANT_VERIFIED",
      "RESTAURANT_VERIFICATION_REJECTED",
      "MENU_APPROVED",
      "MENU_REJECTED",
      "REPORT_RESOLVED",
      "BLOG_HIDDEN",
      "BLOG_REMOVED",
      "BLOG_RESTORED",
      "COMMENT_HIDDEN",
      "COMMENT_REMOVED",
      "COMMENT_RESTORED",
      "REVIEW_HIDDEN",
      "REVIEW_REMOVED",
      "REVIEW_RESTORED",
      "REVIEW_REPLY_HIDDEN",
      "REVIEW_REPLY_REMOVED",
      "REVIEW_REPLY_RESTORED",
      "MOD_CREATED",
      "MOD_UPDATED",
      "MOD_PERMISSIONS_CHANGED",
      "ROLE_PERMISSIONS_CHANGED",
    ]);
    expect(Object.keys(auditEntityTypes)).toEqual([
      "user",
      "restaurant",
      "menu_submission",
      "report",
      "blog",
      "blog_comment",
      "review",
      "review_reply",
      "role",
    ]);
  });

  it("names an entity with its id, and nothing when the row has none", () => {
    expect(auditEntityLabel("menu_submission", 12)).toBe("Bản thực đơn #12");
    expect(auditEntityLabel("role", null)).toBe("Vai trò");
    expect(auditEntityLabel(null, 5)).toBeNull();
  });
});

describe("F-64 ADM-A1 query", () => {
  it("sends only the filters that are set, a Vietnam day as whole instants", () => {
    const query = auditQuery(
      {
        ...emptyAuditFilters,
        action: "USER_SUSPENDED",
        actorRole: "MOD",
        fromDate: "2026-11-01",
        toDate: "2026-11-10",
        actorId: " 37 ",
      },
      2,
    );
    expect(query).toEqual({
      action: "USER_SUSPENDED",
      actorRole: "MOD",
      entityType: undefined,
      from: "2026-11-01T00:00:00+07:00",
      to: "2026-11-10T23:59:59+07:00",
      actorId: 37,
      subjectUserId: undefined,
      entityId: undefined,
      page: 2,
      pageSize: 20,
    });
    expect(auditQueryString(query)).toBe(
      "?action=USER_SUSPENDED&actorRole=MOD&from=2026-11-01T00%3A00%3A00%2B07%3A00&to=2026-11-10T23%3A59%3A59%2B07%3A00&actorId=37&page=2&pageSize=20",
    );
    expect(auditQueryString(auditQuery(emptyAuditFilters, 1))).toBe(
      "?page=1&pageSize=20",
    );
  });

  it("refuses ids that are not positive integers and a range that ends first", () => {
    expect(
      auditFilterProblems({
        ...emptyAuditFilters,
        actorId: "0",
        subjectUserId: "abc",
        entityId: "12",
        fromDate: "2026-11-10",
        toDate: "2026-11-01",
      }),
    ).toEqual({
      actorId: "Nhập một số nguyên dương.",
      subjectUserId: "Nhập một số nguyên dương.",
      toDate: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
    });
    expect(auditFilterProblems(emptyAuditFilters)).toEqual({});
    expect(
      activeAuditFilters({
        ...emptyAuditFilters,
        action: "USER_LOGIN",
        entityId: "3",
      }),
    ).toBe(2);
  });

  it("groups by the day in Vietnam", () => {
    const now = new Date("2026-11-10T05:00:00Z");
    expect(auditDay("2026-11-09T18:30:00Z", now).label).toBe("Hôm nay");
    expect(auditDay("2026-11-09T16:30:00Z", now).label).toBe("Hôm qua");
    expect(auditDay("2026-11-07T10:00:00Z", now)).toEqual({
      key: "2026-11-07",
      label: "07/11/2026",
    });
  });
});

describe("F-64 ADM-A2 detail", () => {
  it("lists changed columns, lists as added and removed, and keeps the reason apart", () => {
    const detail = {
      oldValues: { status: "active", permission_codes: ["A", "B"] },
      newValues: {
        status: "suspended",
        suspended_until: "2026-10-09T08:00:00Z",
        permission_codes: ["B", "C"],
        reason: "Spam quảng cáo nhiều lần",
      },
    };
    const changes = auditChanges(detail);
    expect(changes.map((change) => change.key)).toEqual([
      "status",
      "suspended_until",
      "permission_codes",
    ]);
    expect(changes[0]).toMatchObject({
      label: "Trạng thái",
      before: "active",
      after: "suspended",
    });
    expect(changes[1].before).toBeUndefined();
    expect(changes[2]).toMatchObject({ added: ["C"], removed: ["A"] });
    expect(auditReason(detail)).toBe("Spam quảng cáo nhiều lần");
    expect(auditChanges({ oldValues: null, newValues: null })).toEqual([]);
    expect(auditReason({ newValues: { reason: "  " } })).toBeNull();
  });

  it("reads values in Vietnamese", () => {
    expect(auditValueText("suspended")).toBe("Tạm khóa");
    expect(auditValueText(null)).toBe("Trống");
    expect(auditValueText(true)).toBe("Có");
    expect(auditValueText("2026-10-09T08:00:00Z")).toContain("15:00");
    expect(auditValueText(["approved", "x"])).toBe("Đã duyệt, x");
  });

  it("shortens a user agent and explains the documented errors", () => {
    expect(
      auditAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      ),
    ).toBe("Chrome trên Windows");
    expect(auditAgent(null)).toBe("Không ghi nhận");
    expect(auditAgent("node")).toBe("node");
    expect(
      auditError(
        new ApiError(
          404,
          "AUDIT_LOG_NOT_FOUND",
          "Không tìm thấy bản ghi audit log.",
        ),
      ),
    ).toBe("Không tìm thấy bản ghi nhật ký này.");
  });
});

describe("F-64 proxy allowlist", () => {
  it("lets only ADM-A1 and ADM-A2 reads through", () => {
    for (const path of ["admin/audit-logs", "admin/audit-logs/9921"])
      expect(adminAuditOperation("GET", path)).toEqual({
        body: false,
        status: 200,
      });
    for (const [method, path] of [
      ["POST", "admin/audit-logs"],
      ["DELETE", "admin/audit-logs/9921"],
      ["GET", "admin/audit-logs/0"],
      ["GET", "admin/audit-logs/abc"],
      ["GET", "admin/audit-logs/1/export"],
    ])
      expect(adminAuditOperation(method, path), `${method} ${path}`).toBeNull();
  });
});
