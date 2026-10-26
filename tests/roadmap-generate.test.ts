import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGenerateRequest,
  createdItemCount,
  generateError,
  generationDoneText,
  generationFailureText,
  generationJobError,
  generationStatusText,
  generationSummary,
  hasGenerationOrigin,
  initialGenerateForm,
  isGenerationFinished,
  preferenceTags,
  replacedItemCount,
  tagChoice,
  toggleMealSlot,
  validateGenerateForm,
  withTagChoice,
  type GenerateForm,
} from "@/features/roadmaps/roadmap-generate-rules";
import {
  forgetGenerationJob,
  recallGenerationJob,
  rememberGenerationJob,
} from "@/features/roadmaps/roadmap-generation-job";
import { mealSlotLabels } from "@/features/roadmaps/roadmap-detail-rules";
import { roadmapService } from "@/features/roadmaps/roadmap-service";
import type {
  RoadmapDayDto,
  RoadmapTagDto,
} from "@/features/roadmaps/roadmap-types";
import { ApiError } from "@/shared/api/error";
import {
  roadmapOperation,
  roadmapOperationStatus,
} from "@/shared/api/roadmap-proxy";

const form = (patch: Partial<GenerateForm> = {}): GenerateForm => ({
  ...initialGenerateForm({
    scope: "full",
    dayId: 301,
    mealSlot: "lunch",
    province: "  Thành phố Hà Nội ",
  }),
  ...patch,
});

const day = (
  dayId: number,
  ...slots: ("breakfast" | "lunch" | "dinner" | "snack")[]
): RoadmapDayDto => ({
  dayId,
  dayNumber: dayId - 300,
  date: null,
  note: null,
  dayCost: 0,
  items: slots.map((mealSlot, index) => ({
    id: dayId * 10 + index,
    mealSlot,
  })) as never,
});

const tag = (
  id: number,
  tagType: RoadmapTagDto["tagType"],
  name: string,
): RoadmapTagDto => ({ id, tagType, code: name, name });

describe("RM-10 body", () => {
  it("sends the documented names for the whole roadmap and leaves empty options out", () => {
    expect(buildGenerateRequest(form(), { originMode: "none" })).toEqual({
      scope: "full",
      province: "Thành phố Hà Nội",
      mealSlots: ["breakfast", "lunch", "dinner"],
    });
  });
  it("adds the day, the constraints and the note for one day", () => {
    expect(
      buildGenerateRequest(
        form({
          scope: "day",
          dayId: "302",
          mealSlots: ["lunch", "breakfast", "snack"],
          maxPrice: "80000",
          note: "  Ưu tiên món nước ",
          replaceExisting: true,
          preferTagIds: [9],
          excludeTagIds: [12],
        }),
        { originMode: "none" },
      ),
    ).toEqual({
      scope: "day",
      dayId: 302,
      province: "Thành phố Hà Nội",
      // Always in day order, whatever order they were ticked in.
      mealSlots: ["breakfast", "lunch", "snack"],
      replaceExisting: true,
      maxPricePerMeal: 80000,
      tagIds: [9],
      excludeTagIds: [12],
      note: "Ưu tiên món nước",
    });
  });
  it("sends mealSlot, not mealSlots, for one meal", () => {
    const body = buildGenerateRequest(
      form({ scope: "slot", dayId: "301", mealSlot: "dinner" }),
      { originMode: "none" },
    );
    expect(body).toEqual({
      scope: "slot",
      dayId: 301,
      mealSlot: "dinner",
      province: "Thành phố Hà Nội",
    });
    expect(body).not.toHaveProperty("mealSlots");
  });
  it("sends the position only for a gps roadmap, as a pair, and the radius only with an origin", () => {
    const gps = { latitude: 21.028511, longitude: 105.854167 };
    expect(
      buildGenerateRequest(form({ radiusKm: "7,5" }), {
        originMode: "gps",
        gps,
      }),
    ).toMatchObject({
      currentLatitude: 21.028511,
      currentLongitude: 105.854167,
      radiusKm: 7.5,
    });
    // A pinned roadmap uses its stored point: no coordinates, but the radius counts.
    const pinned = buildGenerateRequest(form(), {
      originMode: "pinned",
      gps,
    });
    expect(pinned).not.toHaveProperty("currentLatitude");
    expect(pinned).not.toHaveProperty("currentLongitude");
    expect(pinned.radiusKm).toBe(10);
    // gps roadmap without a position, or no origin at all: no radius to measure from.
    for (const options of [
      { originMode: "gps" as const },
      { originMode: "none" as const },
    ]) {
      const body = buildGenerateRequest(form(), options);
      expect(body).not.toHaveProperty("radiusKm");
      expect(body).not.toHaveProperty("currentLatitude");
    }
    expect(hasGenerationOrigin("gps", undefined)).toBe(false);
    expect(hasGenerationOrigin("gps", gps)).toBe(true);
    expect(hasGenerationOrigin("pinned", undefined)).toBe(true);
    expect(hasGenerationOrigin("none", gps)).toBe(false);
  });
});

describe("RM-10 form rules", () => {
  it("mirrors the backend validator", () => {
    expect(validateGenerateForm(form(), { hasOrigin: true })).toEqual({});
    expect(
      validateGenerateForm(form({ province: "  " }), { hasOrigin: false }),
    ).toHaveProperty("province");
    expect(
      validateGenerateForm(form({ province: "x".repeat(101) }), {
        hasOrigin: false,
      }),
    ).toHaveProperty("province");
    expect(
      validateGenerateForm(form({ scope: "day", dayId: "" }), {
        hasOrigin: false,
      }),
    ).toHaveProperty("dayId");
    expect(
      validateGenerateForm(form({ mealSlots: [] }), { hasOrigin: false }),
    ).toHaveProperty("mealSlots");
    // One meal needs a day but no list of meals.
    expect(
      validateGenerateForm(form({ scope: "slot", mealSlots: [] }), {
        hasOrigin: false,
      }),
    ).toEqual({});
    expect(
      validateGenerateForm(form({ maxPrice: "1".repeat(15) }), {
        hasOrigin: false,
      }),
    ).toHaveProperty("maxPrice");
    expect(
      validateGenerateForm(form({ note: "x".repeat(501) }), {
        hasOrigin: false,
      }),
    ).toHaveProperty("note");
    for (const radiusKm of ["0", "51", "", "abc"])
      expect(
        validateGenerateForm(form({ radiusKm }), { hasOrigin: true }),
      ).toHaveProperty("radiusKm");
    // The radius is ignored without an origin.
    expect(
      validateGenerateForm(form({ radiusKm: "999" }), { hasOrigin: false }),
    ).toEqual({});
  });
  it("keeps a tag either preferred or avoided, never both", () => {
    let current = form();
    current = withTagChoice(current, 9, "prefer");
    expect(tagChoice(current, 9)).toBe("prefer");
    current = withTagChoice(current, 9, "exclude");
    expect(tagChoice(current, 9)).toBe("exclude");
    expect(current.preferTagIds).toEqual([]);
    expect(current.excludeTagIds).toEqual([9]);
    current = withTagChoice(current, 9, "none");
    expect(tagChoice(current, 9)).toBe("none");
  });
  it("offers dietary and category tags only, and meals in day order", () => {
    expect(
      preferenceTags([
        tag(1, "meal_time", "Bữa sáng"),
        tag(4, "category", "Món nước"),
        tag(6, "dietary", "Món chay"),
      ]).map((entry) => entry.id),
    ).toEqual([4, 6]);
    expect(toggleMealSlot(["dinner", "breakfast"], "lunch", true)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
    ]);
    expect(toggleMealSlot(["breakfast", "lunch"], "lunch", false)).toEqual([
      "breakfast",
    ]);
  });
  it("counts what replaceExisting would delete", () => {
    const itinerary = [
      day(301, "breakfast", "lunch", "snack"),
      day(302, "breakfast", "dinner"),
    ];
    expect(replacedItemCount(form(), itinerary)).toBe(4);
    expect(
      replacedItemCount(form({ mealSlots: ["breakfast"] }), itinerary),
    ).toBe(2);
    expect(
      replacedItemCount(form({ scope: "day", dayId: "302" }), itinerary),
    ).toBe(2);
    expect(
      replacedItemCount(
        form({ scope: "slot", dayId: "301", mealSlot: "snack" }),
        itinerary,
      ),
    ).toBe(1);
    expect(
      replacedItemCount(form({ mealSlots: ["late_night"] }), itinerary),
    ).toBe(0);
  });
  it("describes the request in the progress view", () => {
    expect(
      generationSummary(form(), "Thứ Bảy, 10 tháng 10", mealSlotLabels),
    ).toBe("Cả lộ trình · Thành phố Hà Nội");
    expect(
      generationSummary(
        form({ scope: "slot", mealSlot: "dinner" }),
        "Thứ Bảy, 10 tháng 10",
        mealSlotLabels,
      ),
    ).toBe("Thứ Bảy, 10 tháng 10 · Bữa tối · Thành phố Hà Nội");
  });
});

describe("RM-11 job", () => {
  it("knows when to stop polling and what to say", () => {
    expect(isGenerationFinished("queued")).toBe(false);
    expect(isGenerationFinished("running")).toBe(false);
    expect(isGenerationFinished("succeeded")).toBe(true);
    expect(isGenerationFinished("failed")).toBe(true);
    expect(generationStatusText("queued")).toMatch(/xếp hàng/);
    expect(generationStatusText("running")).toMatch(/chọn món/);
    expect(createdItemCount({ createdItemIds: [1510, 1511, 1512] })).toBe(3);
    expect(generationDoneText(3)).toMatch(/thêm 3 món/);
    expect(generationDoneText(0)).toMatch(/không thêm món nào/);
  });
  it("shows the backend's own failure message, with a fallback", () => {
    expect(
      generationFailureText({
        errorMessage: "Không tìm thấy món phù hợp với các điều kiện đã chọn.",
      }),
    ).toBe("Không tìm thấy món phù hợp với các điều kiện đã chọn.");
    expect(generationFailureText({ errorMessage: null })).toMatch(
      /chưa tạo được lịch/,
    );
  });
  it("remembers the running job only as a convenience", () => {
    // Node has no `window`: every helper must simply do nothing.
    expect(recallGenerationJob(88)).toBeNull();
    expect(() => rememberGenerationJob(88, 77)).not.toThrow();
    expect(() => forgetGenerationJob(88)).not.toThrow();
  });
});

describe("errors by errorCode", () => {
  it("tells a job already running from other RM-10 failures", () => {
    expect(
      generateError(new ApiError(409, "GENERATION_IN_PROGRESS", "x")),
    ).toMatchObject({ inProgress: true });
    expect(
      generateError(new ApiError(404, "DAY_NOT_FOUND", "x")).message,
    ).toMatch(/Không tìm thấy ngày/);
    expect(
      generateError(new ApiError(404, "ROADMAP_NOT_FOUND", "x")).message,
    ).toMatch(/Không tìm thấy lộ trình/);
    expect(
      generateError(new ApiError(400, "VALIDATION_FAILED", "x")).message,
    ).toMatch(/chưa hợp lệ/);
    const other = generateError(new ApiError(503, "SERVICE_UNAVAILABLE", "x"));
    expect(other.inProgress).toBe(false);
    expect(other.message).toMatch(/kết nối/);
  });
  it("tells a job that is not there from other RM-11 failures", () => {
    expect(
      generationJobError(new ApiError(404, "JOB_NOT_FOUND", "x")),
    ).toMatchObject({ missing: true });
    expect(
      generationJobError(new ApiError(503, "SERVICE_UNAVAILABLE", "x")).missing,
    ).toBe(false);
  });
});

describe("RM-10 and RM-11 proxy rules", () => {
  it("allows exactly POST generate and GET generation-jobs/{id}", () => {
    expect(roadmapOperation("POST", "roadmaps/88/generate")).toBe(true);
    expect(roadmapOperation("GET", "roadmaps/88/generation-jobs/77")).toBe(
      true,
    );
    expect(roadmapOperation("GET", "roadmaps/88/generate")).toBe(false);
    expect(roadmapOperation("PATCH", "roadmaps/88/generate")).toBe(false);
    expect(roadmapOperation("DELETE", "roadmaps/88/generation-jobs/77")).toBe(
      false,
    );
    expect(roadmapOperation("POST", "roadmaps/88/generation-jobs/77")).toBe(
      false,
    );
    expect(roadmapOperation("GET", "roadmaps/88/generation-jobs")).toBe(false);
    expect(roadmapOperation("GET", "roadmaps/88/generation-jobs/0")).toBe(
      false,
    );
    expect(roadmapOperation("POST", "roadmaps/x/generate")).toBe(false);
  });
  it("answers RM-10 with 202 Accepted and leaves the other statuses alone", () => {
    expect(roadmapOperationStatus("POST", "roadmaps/88/generate")).toBe(202);
    expect(
      roadmapOperationStatus("POST", "roadmaps/88/days/301/items"),
    ).toBeUndefined();
    expect(
      roadmapOperationStatus("GET", "roadmaps/88/generation-jobs/77"),
    ).toBeUndefined();
  });
});

describe("RM-10 and RM-11 service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  function stubFetch(data: unknown, status = 200) {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            message: null,
            errorCode: null,
            data,
          }),
          { status, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api");
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  it("posts the body to generate and reads the queued job", async () => {
    const fetchMock = stubFetch({ jobId: 77, status: "queued" }, 202);
    await expect(
      roadmapService.generate(88, { scope: "full", province: "Hà Nội" }),
    ).resolves.toEqual({ jobId: 77, status: "queued" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/backend/roadmaps/88/generate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      scope: "full",
      province: "Hà Nội",
    });
  });
  it("reads a job and the tag catalog with GET", async () => {
    const job = {
      jobId: 77,
      scope: "day",
      status: "succeeded",
      errorMessage: null,
      createdItemIds: [1510],
      createdAt: "2026-10-02T02:20:00Z",
      finishedAt: "2026-10-02T02:20:04Z",
    };
    const fetchMock = stubFetch(job);
    await expect(roadmapService.generationJob(88, 77)).resolves.toEqual(job);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/backend/roadmaps/88/generation-jobs/77",
    );
    const tags = stubFetch([tag(4, "category", "Món nước")]);
    await expect(roadmapService.tags()).resolves.toHaveLength(1);
    expect((tags.mock.calls[0] as unknown as [string])[0]).toBe(
      "/api/backend/tags",
    );
  });
});
