import { describe, expect, it } from "vitest";
import {
  createModBody,
  displayNameProblem,
  modError,
  modFieldErrors,
  modStatusTone,
  nameLength,
  validateModForm,
} from "@/features/admin/mod-rules";
import {
  adminModsOperation,
  adminPermissionsOperation,
} from "@/shared/api/admin-proxy";
import { ApiError } from "@/shared/api/error";

describe("F-65 Mod form (CreateModRequestDtoValidator, UpdateModRequestDtoValidator)", () => {
  it("needs an e-mail and a 2..100 character name, counted after trimming", () => {
    expect(validateModForm({ email: "", displayName: "" })).toEqual({
      email: "Nhập email của Mod.",
      displayName: "Nhập tên hiển thị của Mod.",
    });
    expect(validateModForm({ email: "linh.mod@", displayName: " L " })).toEqual(
      {
        email: "Email chưa đúng định dạng, ví dụ: linh.mod@angi.vn.",
        displayName: "Tên hiển thị cần ít nhất 2 ký tự.",
      },
    );
    expect(
      validateModForm({ email: "linh.mod@angi.vn", displayName: "Mod Linh" }),
    ).toEqual({});
    expect(displayNameProblem("a".repeat(101))).toBe(
      "Tên hiển thị không được vượt quá 100 ký tự.",
    );
    expect(displayNameProblem("a".repeat(100))).toBe("");
  });

  it("counts characters like the BE (an emoji is one, not two)", () => {
    expect(nameLength("  Mod 😀 ")).toBe(5);
  });

  it("sends the trimmed fields and the overrides only when some were chosen", () => {
    expect(
      createModBody(
        { email: " linh.mod@angi.vn ", displayName: " Mod Linh " },
        [],
      ),
    ).toEqual({ email: "linh.mod@angi.vn", displayName: "Mod Linh" });
    expect(
      createModBody({ email: "a@b.vn", displayName: "Mod A" }, [
        { permissionCode: "USER_BAN", effect: "deny" },
      ]),
    ).toEqual({
      email: "a@b.vn",
      displayName: "Mod A",
      permissionOverrides: [{ permissionCode: "USER_BAN", effect: "deny" }],
    });
  });

  it("puts the BE errors under the right field", () => {
    expect(
      modFieldErrors(new ApiError(409, "EMAIL_ALREADY_EXISTS", "x")),
    ).toEqual({
      email: "Email này đã có tài khoản ANGI. Hãy dùng email khác.",
    });
    expect(
      modFieldErrors(
        new ApiError(400, "VALIDATION_FAILED", "x", {
          DisplayName: ["Tên hiển thị phải có ít nhất 2 ký tự."],
        }),
      ),
    ).toEqual({ displayName: "Tên hiển thị phải có ít nhất 2 ký tự." });
    expect(modFieldErrors(new Error("network"))).toEqual({});
  });

  it("words the error codes and the statuses", () => {
    expect(modError(new ApiError(404, "MOD_NOT_FOUND", "x"))).toContain(
      "Không tìm thấy tài khoản Mod",
    );
    expect(modError(new ApiError(400, "UNKNOWN_PERMISSION", "x"))).toContain(
      "quyền không hợp lệ",
    );
    expect(modStatusTone("active")).toBe("success");
    expect(modStatusTone("deactivated")).toBe("neutral");
  });
});

describe("F-65 admin proxy", () => {
  it("lets ADM-M2, ADM-M3 and ADM-M4 through with their status", () => {
    expect(adminModsOperation("POST", "admin/mods")).toEqual({
      body: true,
      status: 201,
    });
    expect(adminModsOperation("GET", "admin/mods/12")).toEqual({
      body: false,
      status: 200,
    });
    expect(adminModsOperation("PATCH", "admin/mods/12")).toEqual({
      body: true,
      status: 200,
    });
    // ADM-M1 is the permissions proxy's list.
    expect(adminPermissionsOperation("GET", "admin/mods")).not.toBeNull();
  });

  it("rejects other methods and ids", () => {
    for (const [method, path] of [
      ["DELETE", "admin/mods/12"],
      ["PUT", "admin/mods/12"],
      ["GET", "admin/mods/0"],
      ["GET", "admin/mods/abc"],
      ["PATCH", "admin/mods"],
      ["POST", "admin/mods/12"],
    ])
      expect(adminModsOperation(method, path), `${method} ${path}`).toBeNull();
  });
});
