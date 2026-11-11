import { describe, expect, it } from "vitest";
import {
  isStaleReportError,
  plainText,
  reasonLabel,
  reportHandlingError,
  resolutionActionsFor,
  resolveProblems,
  resolveRequest,
  type ResolveForm,
} from "@/features/moderation/report-handling-rules";
import { ApiError } from "@/shared/api/error";

const form = (over: Partial<ResolveForm> = {}): ResolveForm => ({
  outcome: "resolved",
  action: "none",
  note: "",
  suspendUntil: "",
  ...over,
});
const now = Date.parse("2026-11-03T10:00:00");

describe("F-59 actions by target", () => {
  it("offers only the actions MOD-RP4 accepts for the target type", () => {
    expect(resolutionActionsFor("restaurant").map((a) => a.value)).toEqual([
      "none",
      "hide_restaurant",
      "suspend_restaurant",
      "warn_user",
      "suspend_user",
      "ban_user",
    ]);
    expect(resolutionActionsFor("blog").map((a) => a.value)).toEqual([
      "none",
      "hide_blog",
      "remove_blog",
      "warn_user",
      "suspend_user",
      "ban_user",
    ]);
    expect(resolutionActionsFor("restaurant")[3].label).toBe(
      "Cảnh cáo chủ quán",
    );
  });
});

describe("F-59 conclusion", () => {
  it("needs a future end for a suspension and a note of at most 1000 characters", () => {
    expect(resolveProblems(form(), now)).toEqual({});
    expect(resolveProblems(form({ action: "suspend_user" }), now)).toEqual({
      suspendUntil: "Chọn thời điểm hết hạn tạm khóa.",
    });
    expect(
      resolveProblems(
        form({ action: "suspend_user", suspendUntil: "2026-11-02T10:00" }),
        now,
      ),
    ).toEqual({
      suspendUntil: "Thời điểm hết hạn tạm khóa phải ở tương lai.",
    });
    expect(
      resolveProblems(
        form({ outcome: "dismissed", action: "suspend_user" }),
        now,
      ),
    ).toEqual({});
    expect(resolveProblems(form({ note: "x".repeat(1001) }), now).note).toBe(
      "Ghi chú không được vượt quá 1000 ký tự.",
    );
  });

  it("builds the MOD-RP4 body; a dismissal never acts on the target", () => {
    expect(
      resolveRequest(
        form({ outcome: "dismissed", action: "hide_restaurant", note: " " }),
        true,
      ),
    ).toEqual({
      outcome: "dismissed",
      resolutionAction: "none",
      applyToRelatedReports: true,
    });
    expect(
      resolveRequest(form({ action: "hide_restaurant", note: " Bẩn " }), false),
    ).toEqual({
      outcome: "resolved",
      resolutionAction: "hide_restaurant",
      resolutionNote: "Bẩn",
      applyToRelatedReports: false,
    });
    const suspended = resolveRequest(
      form({ action: "suspend_user", suspendUntil: "2026-11-10T08:30" }),
      true,
    );
    expect(suspended.suspendUntil).toBe(
      new Date("2026-11-10T08:30").toISOString(),
    );
  });
});

describe("F-59 errors and text", () => {
  it("words the codes of the Mã lỗi sheet and reloads on stale ones", () => {
    const claimed = new ApiError(409, "REPORT_ALREADY_CLAIMED", "x");
    expect(reportHandlingError(claimed)).toContain("Mod khác nhận xử lý");
    expect(isStaleReportError(claimed)).toBe(true);
    expect(isStaleReportError(new ApiError(409, "REPORT_CLOSED", "x"))).toBe(
      true,
    );
    expect(
      reportHandlingError(
        new ApiError(400, "ACTION_NOT_ALLOWED_FOR_TARGET", "x"),
      ),
    ).toBe("Hành động này không áp dụng cho loại đối tượng bị báo cáo.");
    expect(
      reportHandlingError(
        new ApiError(400, "VALIDATION_FAILED", "x", {
          suspendUntil: ["Thời điểm hết hạn tạm khóa phải ở tương lai."],
        }),
      ),
    ).toBe("Thời điểm hết hạn tạm khóa phải ở tương lai.");
    expect(isStaleReportError(new ApiError(403, "FORBIDDEN", "x"))).toBe(false);
  });

  it("labels reasons and strips blog HTML", () => {
    expect(reasonLabel("hygiene")).toBe("Vệ sinh");
    expect(reasonLabel("future_code")).toBe("future_code");
    expect(plainText("<p>Ăn&nbsp;ngon</p>\n<p>quá</p>")).toBe("Ăn ngon quá");
  });
});
