import { describe, expect, it } from "vitest";
import {
  verificationDateLabel,
  verificationDocumentUrl,
} from "@/features/owner/verification-details";
import {
  verificationHistoryFixture,
  verificationStatusSample,
} from "./fixtures/verification-history";

describe("OWN-07 status and history", () => {
  it.each([
    ["pending", "pending"],
    ["approved", "verified"],
    ["rejected", "rejected"],
    ["needs_more_info", "rejected"],
    ["cancelled", "unverified"],
  ] as const)(
    "keeps %s attempts newest-first with nullable review fields and previous links",
    (status, restaurantStatus) => {
      const history = verificationHistoryFixture(status);
      expect(history.verificationStatus).toBe(restaurantStatus);
      expect(history.items.map((item) => item.id)).toEqual([23, 22, 21]);
      expect(history.items.map((item) => item.previousId)).toEqual([
        22,
        21,
        null,
      ]);
      const latest = history.items[0];
      expect(latest.status).toBe(status);
      const reviewed = status !== "pending" && status !== "cancelled";
      expect(latest.reviewedBy === null).toBe(!reviewed);
      expect(latest.reviewedAt === null).toBe(!reviewed);
    },
  );
  it("keeps the OWN-07 sample as one pending attempt without a document URL", () => {
    expect(verificationStatusSample.items).toHaveLength(1);
    expect(verificationStatusSample.items[0].documents[0].url).toBe("");
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
