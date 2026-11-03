import { describe, expect, it } from "vitest";
import {
  codesDiff,
  effectivePermissions,
  groupPermissions,
  inCatalogOrder,
  isGrantable,
  overrideChoice,
  overridesBody,
  permissionError,
  sameCodes,
  withOverride,
} from "@/features/admin/permission-rules";
import { modsQueryString } from "@/features/admin/permission-service";
import type { PermissionDto } from "@/features/admin/permission-types";
import { adminPermissionsOperation } from "@/shared/api/admin-proxy";
import { ApiError } from "@/shared/api/error";

// Codes of the Enum sheet ("permission code"), in catalog order.
const catalog: PermissionDto[] = [
  "USER_VIEW_AUDIT",
  "USER_SUSPEND",
  "USER_BAN",
  "RESTAURANT_VERIFY",
  "RESTAURANT_MODERATE",
  "MENU_APPROVE",
  "REPORT_RESTAURANT_HANDLE",
  "REPORT_SOCIAL_HANDLE",
  "BLOG_MODERATE",
  "REVIEW_MODERATE",
  "MOD_MANAGE",
  "SYSTEM_AUDIT_VIEW",
  "DASHBOARD_VIEW",
].map((code) => ({ code, description: code.toLowerCase() }));

describe("F-66 permission rules", () => {
  it("never offers the Admin-only permissions to a Mod", () => {
    expect(isGrantable("MOD_MANAGE")).toBe(false);
    expect(isGrantable("SYSTEM_AUDIT_VIEW")).toBe(false);
    expect(isGrantable("DASHBOARD_VIEW")).toBe(true);
    expect(isGrantable("USER_BAN")).toBe(true);
  });

  it("groups the catalog by area, keeping its order", () => {
    const groups = groupPermissions([
      ...catalog,
      { code: "NEW_THING", description: "x" },
    ]);
    expect(groups.map((group) => group.title)).toEqual([
      "Người dùng",
      "Nhà hàng và thực đơn",
      "Báo cáo vi phạm",
      "Nội dung cộng đồng",
      "Quản trị hệ thống",
      "Khác",
    ]);
    expect(groups[0].permissions.map((item) => item.code)).toEqual([
      "USER_VIEW_AUDIT",
      "USER_SUSPEND",
      "USER_BAN",
    ]);
    expect(groups[4].permissions.map((item) => item.code)).toEqual([
      "MOD_MANAGE",
      "SYSTEM_AUDIT_VIEW",
      "DASHBOARD_VIEW",
    ]);
  });

  it("compares and diffs the MOD defaults without caring about order", () => {
    expect(
      sameCodes(["USER_BAN", "MENU_APPROVE"], ["MENU_APPROVE", "USER_BAN"]),
    ).toBe(true);
    expect(sameCodes(["USER_BAN"], ["USER_BAN", "MENU_APPROVE"])).toBe(false);
    expect(
      codesDiff(
        ["USER_BAN", "MENU_APPROVE"],
        ["MENU_APPROVE", "BLOG_MODERATE"],
      ),
    ).toEqual({
      added: ["BLOG_MODERATE"],
      removed: ["USER_BAN"],
    });
    expect(inCatalogOrder(["MENU_APPROVE", "USER_SUSPEND"], catalog)).toEqual([
      "USER_SUSPEND",
      "MENU_APPROVE",
    ]);
  });

  it("sets, replaces and clears one override; inherit removes it", () => {
    let overrides = withOverride([], "USER_BAN", "deny");
    expect(overrideChoice(overrides, "USER_BAN")).toBe("deny");
    overrides = withOverride(overrides, "USER_BAN", "allow");
    expect(overrides).toEqual([
      { permissionCode: "USER_BAN", effect: "allow" },
    ]);
    expect(withOverride(overrides, "USER_BAN", "inherit")).toEqual([]);
    expect(overrideChoice([], "MENU_APPROVE")).toBe("inherit");
  });

  it("sends one override per permission in catalog order (ADM-P3 rejects duplicates)", () => {
    expect(
      overridesBody(
        [
          { permissionCode: "MENU_APPROVE", effect: "allow" },
          { permissionCode: "USER_BAN", effect: "deny" },
          { permissionCode: "MENU_APPROVE", effect: "deny" },
        ],
        catalog,
      ),
    ).toEqual([
      { permissionCode: "USER_BAN", effect: "deny" },
      { permissionCode: "MENU_APPROVE", effect: "allow" },
    ]);
  });

  it("computes effective = defaults + allow − deny, as in the ADM-P2 sample", () => {
    // API Design v1.8, sheet "JSON mẫu" r3719–r3733.
    const effective = effectivePermissions(
      ["USER_SUSPEND", "USER_BAN", "MENU_APPROVE"],
      [{ permissionCode: "USER_BAN", effect: "deny" }],
    );
    expect([...effective]).toEqual(["USER_SUSPEND", "MENU_APPROVE"]);
    expect([
      ...effectivePermissions(
        [],
        [{ permissionCode: "BLOG_MODERATE", effect: "allow" }],
      ),
    ]).toEqual(["BLOG_MODERATE"]);
  });

  it("words the error codes of the Mã lỗi sheet", () => {
    expect(permissionError(new ApiError(404, "MOD_NOT_FOUND", "x"))).toContain(
      "Không tìm thấy tài khoản Mod",
    );
    expect(
      permissionError(new ApiError(400, "PERMISSION_NOT_GRANTABLE", "x")),
    ).toContain("chỉ dành cho quản trị viên");
    expect(
      permissionError(new ApiError(400, "UNKNOWN_PERMISSION", "x")),
    ).toContain("không còn trong danh mục");
  });

  it("builds the ADM-M1 query from the filled filters only", () => {
    expect(
      modsQueryString({ q: "  an ", status: "active", page: 2, pageSize: 20 }),
    ).toBe("?q=an&status=active&page=2&pageSize=20");
    expect(modsQueryString({ q: "   " })).toBe("");
  });
});

describe("F-66 admin proxy", () => {
  it("lets exactly ADM-P1..ADM-P4 and ADM-M1 through", () => {
    expect(adminPermissionsOperation("GET", "admin/permissions")).toEqual({
      body: false,
      status: 200,
    });
    expect(adminPermissionsOperation("GET", "admin/mods")?.body).toBe(false);
    expect(
      adminPermissionsOperation("GET", "admin/mods/12/permissions")?.body,
    ).toBe(false);
    expect(
      adminPermissionsOperation("PUT", "admin/mods/12/permissions")?.body,
    ).toBe(true);
    expect(
      adminPermissionsOperation("PUT", "admin/roles/MOD/permissions")?.body,
    ).toBe(true);
  });

  it("rejects other methods, roles and ids", () => {
    for (const [method, path] of [
      ["POST", "admin/permissions"],
      ["PUT", "admin/permissions"],
      ["POST", "admin/mods"],
      ["PATCH", "admin/mods/12"],
      ["GET", "admin/mods/12"],
      ["GET", "admin/mods/0/permissions"],
      ["GET", "admin/mods/abc/permissions"],
      ["DELETE", "admin/mods/12/permissions"],
      ["PUT", "admin/roles/ADMIN/permissions"],
      ["GET", "admin/roles/MOD/permissions"],
      ["GET", "admin/audit-logs"],
    ])
      expect(
        adminPermissionsOperation(method, path),
        `${method} ${path}`,
      ).toBeNull();
  });
});
