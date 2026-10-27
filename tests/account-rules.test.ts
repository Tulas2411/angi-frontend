import { describe, expect, it } from "vitest";
import {
  accountFieldErrors,
  buildPasswordRequest,
  buildProfilePatch,
  normalizePhone,
  profileFormFromProfile,
  validatePasswordForm,
  validatePhone,
  validateProfilePatch,
} from "@/features/account/account-rules";

const profile = {
  displayName: "Minh Anh",
  phone: "0901234567",
  bio: "Thích bún",
};

describe("ME-02 profile patch", () => {
  it("sends only changed trimmed fields", () => {
    const values = profileFormFromProfile(profile);
    expect(buildProfilePatch(values, profile)).toEqual({});
    expect(
      buildProfilePatch({ ...values, displayName: "  Minh Anh Mới " }, profile),
    ).toEqual({ displayName: "Minh Anh Mới" });
  });
  it("clears phone and bio with explicit null and treats null originals as empty", () => {
    const values = { displayName: "Minh Anh", phone: " ", bio: "" };
    expect(buildProfilePatch(values, profile)).toEqual({
      phone: null,
      bio: null,
    });
    expect(
      buildProfilePatch(values, {
        displayName: "Minh Anh",
        phone: null,
        bio: null,
      }),
    ).toEqual({});
  });
  it("validates only edited fields against the documented limits", () => {
    expect(validateProfilePatch({})).toEqual({});
    expect(validateProfilePatch({ displayName: "A" })).toHaveProperty(
      "displayName",
    );
    expect(validateProfilePatch({ displayName: "A".repeat(100) })).toEqual({});
    expect(
      validateProfilePatch({ displayName: "A".repeat(101) }),
    ).toHaveProperty("displayName");
    expect(validateProfilePatch({ phone: "1".repeat(21) })).toHaveProperty(
      "phone",
    );
    expect(validateProfilePatch({ phone: null, bio: null })).toEqual({});
    expect(validateProfilePatch({ bio: "x".repeat(501) })).toHaveProperty(
      "bio",
    );
  });
});

describe("ME-02 phone format", () => {
  it("accepts a ten-digit Vietnamese mobile number", () => {
    for (const phone of ["0901234567", "0387654321", "0512345678", "0912345678"]) {
      expect(validatePhone(phone), phone).toBeNull();
      expect(validateProfilePatch({ phone }), phone).toEqual({});
    }
  });
  it("treats an empty phone as optional", () => {
    expect(validatePhone("")).toBeNull();
    expect(validatePhone("   ")).toBeNull();
  });
  it("rejects a wrong digit count", () => {
    expect(validatePhone("090123456")).toMatch(/10 chữ số/);
    expect(validatePhone("09012345678")).toMatch(/10 chữ số/);
  });
  it("rejects a prefix that is not a Vietnamese mobile prefix", () => {
    expect(validatePhone("0112345678")).toMatch(/bắt đầu bằng/);
    expect(validatePhone("0212345678")).toMatch(/bắt đầu bằng/);
  });
  it("rejects letters and other unexpected characters", () => {
    expect(validatePhone("090123456a")).toMatch(/ký tự phân tách/);
    expect(validatePhone("090#123456")).toMatch(/ký tự phân tách/);
  });
  it("allows separators and normalizes them away", () => {
    expect(validatePhone("090 123 4567")).toBeNull();
    expect(validatePhone("090-123-4567")).toBeNull();
    expect(validatePhone("(090) 123.4567")).toBeNull();
    expect(validatePhone("+84 901 234 567")).toBeNull();
    expect(normalizePhone("+84 901 234 567")).toBe("0901234567");
    expect(normalizePhone("090-123-4567")).toBe("0901234567");
    expect(normalizePhone("  ")).toBe("");
  });
  it("sends the normalized number and ignores a retyped equivalent", () => {
    expect(
      buildProfilePatch(
        { ...profileFormFromProfile(profile), phone: "090 123 4567" },
        profile,
      ),
    ).toEqual({});
    expect(
      buildProfilePatch(
        { ...profileFormFromProfile(profile), phone: "+84 901 234 567" },
        profile,
      ),
    ).toEqual({});
    expect(
      buildProfilePatch(
        { ...profileFormFromProfile(profile), phone: "090 123 4568" },
        profile,
      ),
    ).toEqual({ phone: "0901234568" });
  });
});

describe("ME-03 password change", () => {
  const valid = { current: "Old12345", next: "New12345", confirm: "New12345" };
  it("requires the current password only when the account has one", () => {
    expect(validatePasswordForm(valid, true)).toEqual({});
    expect(
      validatePasswordForm({ ...valid, current: "" }, true),
    ).toHaveProperty("currentPassword");
    expect(validatePasswordForm({ ...valid, current: "" }, false)).toEqual({});
  });
  it("enforces length, letter+digit, difference and confirmation", () => {
    expect(
      validatePasswordForm({ ...valid, next: "Ab1", confirm: "Ab1" }, true),
    ).toHaveProperty("newPassword");
    expect(
      validatePasswordForm(
        { ...valid, next: "abcdefgh", confirm: "abcdefgh" },
        true,
      ),
    ).toHaveProperty("newPassword");
    expect(
      validatePasswordForm(
        { ...valid, next: "A1".repeat(33), confirm: "A1".repeat(33) },
        true,
      ),
    ).toHaveProperty("newPassword");
    expect(
      validatePasswordForm(
        { ...valid, next: "Old12345", confirm: "Old12345" },
        true,
      ),
    ).toHaveProperty("newPassword");
    expect(
      validatePasswordForm({ ...valid, confirm: "Other12345" }, true),
    ).toHaveProperty("confirm");
  });
  it("omits currentPassword from the request for password-less accounts", () => {
    expect(buildPasswordRequest(valid, true)).toEqual({
      currentPassword: "Old12345",
      newPassword: "New12345",
    });
    expect(buildPasswordRequest(valid, false)).toEqual({
      newPassword: "New12345",
    });
  });
  it("maps backend error keys in any casing onto form fields", () => {
    expect(
      accountFieldErrors({
        DisplayName: ["Quá ngắn"],
        newPassword: ["Yếu", "Thử lại"],
        Unknown: ["Lỗi"],
      }),
    ).toEqual({
      displayName: "Quá ngắn",
      newPassword: "Yếu Thử lại",
      Unknown: "Lỗi",
    });
  });
});
