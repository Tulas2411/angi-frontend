import { describe, expect, it } from "vitest";
import {
  createMockVerificationService,
  verificationFromDemo,
} from "@/mocks/restaurant-verification";
import {
  applyVerificationHistoryScenario,
  verificationHistoryFixture,
  verificationStatusSample,
} from "@/mocks/verification-history";
import {
  verificationDateLabel,
  verificationDocumentUrl,
} from "@/features/owner/verification-details";
import { initialData } from "@/mocks/fixtures";
import { ownerRestaurantSample } from "./fixtures/owner-restaurant";
import { verificationRequestSample } from "./fixtures/restaurant-verification";

describe("OWN-07 status and history", () => {
  it("uses the documented response wrapper, keeps restaurant and request statuses distinct", async () => {
    const service = createMockVerificationService(
      { ...ownerRestaurantSample, verificationStatus: "pending" },
      verificationStatusSample.items,
    );
    expect(await service.getHistory()).toEqual(verificationStatusSample);
    const verified = createMockVerificationService(
      ownerRestaurantSample,
      verificationStatusSample.items,
    );
    expect(await verified.getHistory()).toMatchObject({
      verificationStatus: "verified",
      items: [{ status: "pending" }],
    });
  });
  it("orders newest first with descending ID for ties, without mutating caller data", async () => {
    const input = verificationHistoryFixture().items.reverse();
    input[1].submittedAt = input[2].submittedAt;
    const original = structuredClone(input);
    const service = createMockVerificationService(ownerRestaurantSample, input);
    const result = await service.getHistory();
    expect(result.items.map((item) => item.id)).toEqual([23, 22, 21]);
    expect(input).toEqual(original);
    result.items[0].documents[0].url = "modified";
    result.items.length = 0;
    expect((await service.getHistory()).items).toHaveLength(3);
    expect((await service.getHistory()).items[0].documents[0].url).toBe("");
  });
  it("isolates history by restaurant and distinguishes empty history from an absent restaurant", async () => {
    const foreign = { ...verificationStatusSample.items[0], restaurantId: 99 };
    const service = createMockVerificationService(
      { ...ownerRestaurantSample, verificationStatus: "unverified" },
      [foreign],
    );
    expect(await service.getHistory()).toEqual({
      verificationStatus: "unverified",
      items: [],
    });
    await expect(
      createMockVerificationService(null).getHistory(),
    ).rejects.toMatchObject({ status: 404, errorCode: "RESTAURANT_NOT_FOUND" });
  });
  it("makes a successful initial submission visible in history and retains older attempts", async () => {
    const old = {
      ...verificationStatusSample.items[0],
      id: 20,
      status: "cancelled" as const,
    };
    const service = createMockVerificationService(
      { ...ownerRestaurantSample, verificationStatus: "unverified" },
      [old],
    );
    const media = await service.upload(
      new File(["local"], "license.pdf", { type: "application/pdf" }),
    );
    const result = await service.submit({
      ...verificationRequestSample,
      documents: [{ docType: "business_license", mediaId: media.id }],
    });
    const response = await service.getHistory();
    expect(response.verificationStatus).toBe("pending");
    expect(response.items[0]).toEqual(result);
    expect(response.items[1]).toEqual(old);
  });
  it.each([
    "pending",
    "approved",
    "rejected",
    "needs_more_info",
    "cancelled",
  ] as const)(
    "round-trips %s, nullable review fields and previous links in demo state",
    (status) => {
      const data = structuredClone(initialData);
      const expected = verificationHistoryFixture(status);
      applyVerificationHistoryScenario(data, status);
      const records = data.submissions.filter(
        (item) =>
          item.kind === "verification" &&
          item.restaurantId === data.ownerRestaurantId,
      );
      expect(records.map((record) => verificationFromDemo(record, 7))).toEqual(
        expected.items,
      );
      expect(
        data.restaurants.find((item) => item.id === data.ownerRestaurantId)
          ?.verification,
      ).toBe(expected.verificationStatus);
    },
  );
  it("updates the selected owner when it is not the first restaurant and preserves others", () => {
    const data = structuredClone(initialData);
    data.ownerRestaurantId = data.restaurants[1].id;
    const first = structuredClone(data.restaurants[0]);
    const otherRecords = data.submissions.filter(
      (item) => item.restaurantId !== data.ownerRestaurantId,
    );
    applyVerificationHistoryScenario(data, "approved");
    expect(data.restaurants[0]).toEqual(first);
    expect(data.restaurants[1].verification).toBe("verified");
    expect(
      data.submissions.filter(
        (item) => item.restaurantId !== data.ownerRestaurantId,
      ),
    ).toEqual(otherRecords);
  });
  it("formats UTC instants in Vietnam time and handles nullable/invalid review dates", () => {
    expect(verificationDateLabel("2026-10-01T20:30:00Z")).toContain("03:30:00");
    expect(verificationDateLabel("2026-10-01T20:30:00Z")).toMatch(
      /2\/10\/2026|02\/10\/2026/,
    );
    expect(verificationDateLabel(null)).toBe("Chưa có");
    expect(verificationDateLabel("invalid")).toBe("Chưa có");
  });
  it("retains signed URL parameters and blocks unsafe or credential-bearing document links", () => {
    const url = "https://cdn.angi.vn/private/9001.pdf?sig=a%2Bb&expires=123";
    expect(verificationDocumentUrl(url)).toBe(url);
    for (const invalid of [
      "",
      "/local/file",
      "javascript:alert(1)",
      "data:text/html,test",
      "https://user:password@example.test/doc",
      "file:///private",
    ])
      expect(verificationDocumentUrl(invalid)).toBeNull();
  });
});
