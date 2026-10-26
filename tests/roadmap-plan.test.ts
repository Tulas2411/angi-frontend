import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/error";
import {
  addDays,
  applyVndEdit,
  formatVndInput,
  buildCreateRoadmapRequest,
  buildRoadmapPatch,
  classifyGpsError,
  gpsProblemMessages,
  emptyRoadmapForm,
  originFromSummary,
  provinceFromOrigin,
  roadmapEndDate,
  roadmapErrorMessage,
  roadmapFieldErrors,
  roadmapFormFromSummary,
  suggestRoadmapTitle,
  validateRoadmapForm,
} from "@/features/roadmaps/roadmap-rules";
import type { RoadmapSummaryDto } from "@/features/roadmaps/roadmap-types";

const values = {
  ...emptyRoadmapForm,
  province: "Thành phố Đà Nẵng",
  title: "  3 ngày ăn sập Đà Nẵng ",
  startDate: "2026-10-10",
  numDays: "3",
  budgetAmount: "1500000",
};
const hotel = {
  name: "Khách sạn Sala",
  latitude: 16.0612041,
  longitude: 108.2275312,
};

// RM-01 JSON sample (API Design v1.8, sheet "JSON mẫu", overview).
const summary: RoadmapSummaryDto = {
  id: 88,
  title: "3 ngày ăn sập Đà Nẵng",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  numDays: 3,
  budgetAmount: 1500000,
  totalEstimatedCost: 640000,
  itemCount: 9,
  coverUrl: null,
  originMode: "pinned",
  originLatitude: 16.061204,
  originLongitude: 108.227531,
  originLabel: "Khách sạn Sala Đà Nẵng",
  createdAt: "2026-10-02T02:00:00Z",
  updatedAt: "2026-10-02T03:00:00Z",
};

describe("RM-01 plan form", () => {
  it("requires the destination, a title and 1–7 days", () => {
    expect(
      Object.keys(
        validateRoadmapForm({ ...emptyRoadmapForm, numDays: "" }, null),
      ),
    ).toEqual(["province", "title", "numDays"]);
    expect(validateRoadmapForm(values, null)).toEqual({});
    for (const numDays of ["0", "8", "30", "2.5", "abc"])
      expect(validateRoadmapForm({ ...values, numDays }, null)).toHaveProperty(
        "numDays",
      );
    expect(validateRoadmapForm({ ...values, numDays: "7" }, null)).toEqual({});
    expect(
      validateRoadmapForm({ ...values, title: "x".repeat(201) }, null),
    ).toHaveProperty("title");
    expect(
      validateRoadmapForm({ ...values, province: "" }, null, {
        requireProvince: false,
      }),
    ).toEqual({});
  });
  it("accepts an empty budget and rejects a negative one", () => {
    expect(validateRoadmapForm({ ...values, budgetAmount: "" }, null)).toEqual(
      {},
    );
    expect(
      validateRoadmapForm({ ...values, budgetAmount: "-1" }, null),
    ).toHaveProperty("budgetAmount");
    expect(validateRoadmapForm({ ...values, budgetAmount: "0" }, null)).toEqual(
      {},
    );
  });
  it("needs a valid point only for a pinned origin", () => {
    const pinned = { ...values, originMode: "pinned" as const };
    expect(validateRoadmapForm(pinned, null)).toHaveProperty("origin");
    expect(
      validateRoadmapForm(pinned, { ...hotel, latitude: 91 }),
    ).toHaveProperty("origin");
    expect(validateRoadmapForm(pinned, hotel)).toEqual({});
    expect(
      validateRoadmapForm({ ...pinned, originLabel: "x".repeat(201) }, hotel),
    ).toHaveProperty("originLabel");
    expect(validateRoadmapForm({ ...values, originMode: "gps" }, null)).toEqual(
      {},
    );
  });
  it("builds the documented body: trimmed title, omitted optionals, coordinates only when pinned", () => {
    expect(buildCreateRoadmapRequest(values, hotel)).toEqual({
      title: "3 ngày ăn sập Đà Nẵng",
      startDate: "2026-10-10",
      numDays: 3,
      budgetAmount: 1500000,
      originMode: "none",
    });
    expect(
      buildCreateRoadmapRequest(
        {
          ...values,
          startDate: "",
          budgetAmount: "",
          originMode: "gps",
          originLabel: "Bỏ qua",
        },
        hotel,
      ),
    ).toEqual({
      title: "3 ngày ăn sập Đà Nẵng",
      numDays: 3,
      originMode: "gps",
    });
    expect(
      buildCreateRoadmapRequest(
        { ...values, originMode: "pinned", originLabel: " Khách sạn Sala " },
        hotel,
      ),
    ).toMatchObject({
      originMode: "pinned",
      originLatitude: 16.061204,
      originLongitude: 108.227531,
      originLabel: "Khách sạn Sala",
    });
    expect(
      buildCreateRoadmapRequest({ ...values, originMode: "pinned" }, hotel),
    ).not.toHaveProperty("originLabel");
  });
  it("computes the end date like RoadmapSummary.endDate and suggests a title", () => {
    expect(roadmapEndDate("2026-10-10", "3")).toBe("2026-10-12");
    expect(roadmapEndDate("2026-12-30", "3")).toBe("2027-01-01");
    expect(roadmapEndDate("", "3")).toBeNull();
    expect(roadmapEndDate("2026-02-30", "3")).toBeNull();
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(suggestRoadmapTitle("Thành phố Hà Nội", "2")).toBe(
      "2 ngày ăn ngon Hà Nội",
    );
    expect(suggestRoadmapTitle("Tỉnh Quảng Ninh", "")).toBe(
      "Ăn ngon Quảng Ninh",
    );
    expect(suggestRoadmapTitle("", "3")).toBe("");
  });
});

describe("RM-04 overview patch", () => {
  const form = roadmapFormFromSummary(summary);
  const origin = originFromSummary(summary);
  it("sends nothing when nothing changed", () => {
    expect(buildRoadmapPatch(form, origin, summary)).toEqual({});
  });
  it("sends only changed fields and clears optional ones with null", () => {
    expect(
      buildRoadmapPatch(
        {
          ...form,
          title: " Đà Nẵng 4 ngày ",
          numDays: "4",
          startDate: "",
          budgetAmount: "",
        },
        origin,
        summary,
      ),
    ).toEqual({
      title: "Đà Nẵng 4 ngày",
      numDays: 4,
      startDate: null,
      budgetAmount: null,
    });
  });
  it("leaving pinned sends only the new mode; the backend clears the coordinates", () => {
    expect(
      buildRoadmapPatch({ ...form, originMode: "none" }, null, summary),
    ).toEqual({ originMode: "none" });
  });
  it("moving the pin or renaming it sends the changed origin fields", () => {
    expect(
      buildRoadmapPatch(
        { ...form, originLabel: "" },
        { name: "Mới", latitude: 16.07, longitude: 108.22 },
        summary,
      ),
    ).toEqual({
      originLatitude: 16.07,
      originLongitude: 108.22,
      originLabel: null,
    });
    const none = {
      ...summary,
      originMode: "none" as const,
      originLatitude: null,
      originLongitude: null,
      originLabel: null,
    };
    expect(
      buildRoadmapPatch(
        { ...roadmapFormFromSummary(none), originMode: "pinned" },
        hotel,
        none,
      ),
    ).toEqual({
      originMode: "pinned",
      originLatitude: 16.061204,
      originLongitude: 108.227531,
    });
  });
  it("only a pinned summary yields an origin point", () => {
    expect(origin).toEqual({
      name: "Khách sạn Sala Đà Nẵng",
      latitude: 16.061204,
      longitude: 108.227531,
    });
    expect(originFromSummary({ ...summary, originMode: "gps" })).toBeNull();
  });
});

describe("roadmap errors", () => {
  it("maps VALIDATION_FAILED keys in any casing onto form fields", () => {
    expect(
      roadmapFieldErrors({
        Title: ["Tên roadmap không được để trống."],
        NumDays: ["Số ngày phải từ 1 đến 30."],
        OriginLatitude: ["Vĩ độ là bắt buộc."],
        originLongitude: ["Kinh độ là bắt buộc."],
      }),
    ).toEqual({
      title: "Tên roadmap không được để trống.",
      numDays: "Số ngày phải từ 1 đến 30.",
      origin: "Vĩ độ là bắt buộc. Kinh độ là bắt buộc.",
    });
  });
  it("explains DAY_NOT_EMPTY and ROADMAP_NOT_FOUND by errorCode", () => {
    expect(
      roadmapErrorMessage(new ApiError(409, "DAY_NOT_EMPTY", "x")),
    ).toMatch(/giảm số ngày/);
    expect(
      roadmapErrorMessage(new ApiError(404, "ROADMAP_NOT_FOUND", "x")),
    ).toMatch(/Không tìm thấy lộ trình/);
    expect(
      roadmapErrorMessage(new ApiError(400, "VALIDATION_FAILED", "x")),
    ).toBe("Vui lòng kiểm tra thông tin đã nhập.");
  });
});

describe("province from the picked origin", () => {
  const point = { name: "Khách sạn Sala", latitude: 16.06, longitude: 108.22 };
  it("uses the catalog province resolved from the address", () => {
    expect(
      provinceFromOrigin({
        ...point,
        addressDetails: { provinceName: "Thành phố Đà Nẵng", ward: "" },
      }),
    ).toEqual({
      province: "Thành phố Đà Nẵng",
      notice: "Đã điền tỉnh / thành phố theo điểm đã chấm: Thành phố Đà Nẵng.",
    });
  });
  it("asks the traveler to choose when no province could be matched", () => {
    for (const picked of [
      point,
      { ...point, addressDetails: { provinceName: "  ", ward: "" } },
    ])
      expect(provinceFromOrigin(picked)).toMatchObject({
        province: "",
        notice: expect.stringContaining("Bạn hãy chọn tỉnh / thành phố"),
      });
  });
});

describe("current location problems", () => {
  it("tells apart a blocked site, an insecure page, no device position and a timeout", () => {
    expect(classifyGpsError(1, true)).toBe("denied");
    expect(classifyGpsError(2, true)).toBe("unavailable");
    expect(classifyGpsError(3, true)).toBe("timeout");
    // Outside https / localhost the browser never prompts, whatever code it reports.
    expect(classifyGpsError(1, false)).toBe("insecure");
    for (const problem of Object.values(gpsProblemMessages))
      expect(problem).toMatch(/bản đồ/);
  });
});

describe("VND budget input", () => {
  it("groups thousands with dots and ends with the unit", () => {
    expect(formatVndInput("")).toBe("");
    expect(formatVndInput("0")).toBe("0 VND");
    expect(formatVndInput("800")).toBe("800 VND");
    expect(formatVndInput("1500000")).toBe("1.500.000 VND");
    expect(formatVndInput("1.500.000 VND")).toBe("1.500.000 VND");
  });
  it("typing reformats and keeps the caret after the typed digit", () => {
    // "1.500 VND" with a "0" typed after the first digit: "10.500 VND", caret after "10".
    expect(applyVndEdit("1500", "10.500 VND", 2, false)).toEqual({
      digits: "10500",
      caret: 2,
    });
    // A digit typed before the first separator moves the caret past the new dot.
    expect(applyVndEdit("999", "9.999 VND", 3, false)).toEqual({
      digits: "9999",
      caret: 3,
    });
    // Typing at the end keeps the caret before the unit.
    expect(applyVndEdit("15", "150 VND", 3, false)).toEqual({
      digits: "150",
      caret: 3,
    });
    expect(applyVndEdit("", "7", 1, false)).toEqual({ digits: "7", caret: 1 });
  });
  it("accepts a pasted formatted amount and drops letters and symbols", () => {
    expect(applyVndEdit("", "1.500.000 VND", 13, false).digits).toBe("1500000");
    expect(applyVndEdit("", "abc", 3, false)).toEqual({ digits: "", caret: 0 });
  });
  it("Backspace on a separator or on the unit removes the digit before it", () => {
    // "1.500 VND", caret right after "." (index 2), Backspace removes the dot only.
    expect(applyVndEdit("1500", "1500 VND", 1, true).digits).toBe("500");
    // Caret after "VND", Backspace removes "D": the last digit goes instead.
    expect(applyVndEdit("1500", "1.500 VN", 8, true)).toEqual({
      digits: "150",
      caret: 3,
    });
    // A normal digit deletion is left alone.
    expect(applyVndEdit("1500", "1.50 VND", 4, true).digits).toBe("150");
  });
  it("strips leading zeros and caps at 14 digits (numeric(14,0))", () => {
    expect(applyVndEdit("0", "05 VND", 2, false)).toEqual({
      digits: "5",
      caret: 1,
    });
    expect(applyVndEdit("", "1".repeat(20), 20, false).digits).toHaveLength(14);
  });
});
