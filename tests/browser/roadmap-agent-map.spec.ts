import { expect, test } from "@playwright/test";
import {
  agentConversation,
  agentProposal,
  agentRoadmap,
} from "../fixtures/agent";
import type { AgentConversation } from "../../src/features/roadmaps/agent-types";
import { stubMapboxRendering } from "./mapbox-fixture";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
} from "./account-api-stub";

let stub: AccountStub;
let conversation: AgentConversation;

/** Two dishes at different restaurants on day 1, the second one replaced by this preview. */
function preview(version = 1) {
  const proposal = agentProposal({ version, proposalId: 90 + version });
  const [first] = proposal.snapshot.items;
  const replaced = {
    ...first,
    itemKey: `new-${version}`,
    mealSlot: "dinner" as const,
    dishId: 200 + version,
    dishName: `Bún chả cá ${version}`,
    latitude: 16.07,
    longitude: 108.22,
  };
  proposal.snapshot.items.push(replaced);
  proposal.snapshot.changes = [
    { type: "replace", targetItemKey: replaced.itemKey, item: replaced },
  ];
  return proposal;
}

test.describe("offline Mapbox assistant preview", () => {
  test.skip(
    process.env.ANGI_TEST_MAPBOX_OFFLINE !== "1",
    "Use playwright.roadmap-map.config.ts with ANGI_TEST_MAPBOX_OFFLINE=1 and its fake token.",
  );

  test.beforeAll(async () => {
    stub = await startAccountStub(5164, ({ method, url }, send) => {
      const path = new URL(url, "http://stub").pathname;
      if (method === "GET" && path === "/api/v1/roadmaps/88") {
        send(200, agentRoadmap());
        return true;
      }
      if (method === "POST" && path === "/api/v1/agent/conversations") {
        send(201, conversation);
        return true;
      }
      if (method === "GET" && path === "/api/v1/agent/conversations/7") {
        send(200, conversation);
        return true;
      }
      if (method === "POST" && path === "/api/v1/impressions") {
        send(202, { accepted: true });
        return true;
      }
      if (
        method === "POST" &&
        path === "/api/v1/agent/conversations/7/messages"
      ) {
        const proposal = preview(2);
        conversation = {
          ...conversation,
          version: conversation.version + 2,
          currentProposal: proposal,
          messages: [{ role: "assistant", content: "Xong rồi!" }],
        };
        send(200, {
          status: "completed",
          reply: "Xong rồi!",
          conversationVersion: conversation.version,
          proposal,
          validation: proposal.validation,
          replayed: false,
        });
        return true;
      }
      return false;
    });
  });
  test.afterAll(async () => stopAccountStub(stub));

  test("draws preview pins on the mounted map without loading another map", async ({
    page,
  }) => {
    stub.reset();
    conversation = agentConversation({ currentProposal: preview() });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubMapboxRendering(page);
    let styleLoads = 0;
    page.on("request", (request) => {
      if (/api\.mapbox\.com\/styles\//.test(request.url())) styleLoads++;
    });
    await loginAs(page, "traveler");
    await page.goto("/roadmaps/88");
    const map = page.getByRole("region", { name: "Bản đồ lộ trình" });
    await expect(map).toHaveAttribute("data-ready", "true");
    const pins = map.locator(".roadmap-map-pin-preview");
    await expect(pins).toHaveCount(0);
    const loaded = styleLoads;

    await page
      .getByRole("button", { name: "✦ Trợ lý món ăn", exact: true })
      .click();
    await expect(pins).toHaveCount(2);
    await expect(
      map.getByRole("button", { name: /điểm 1, ngày 1: Mì Quảng$/ }),
    ).toHaveAttribute("data-changed", "false");
    const changed = map.getByRole("button", {
      name: /điểm 2, ngày 1: Bún chả cá 1, món mới$/,
    });
    await expect(changed).toHaveAttribute("data-changed", "true");

    await changed.click();
    await expect(changed).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: "artifacts/roadmap-agent/preview-pins-1440.png",
    });
    const panel = page.getByRole("dialog", { name: "ANGI Trợ lý ăn uống" });
    await expect(
      panel.getByRole("button", { name: /Bún chả cá 1/ }),
    ).toHaveAttribute("aria-pressed", "true");

    // A later preview replaces the pins in place.
    await panel.getByLabel("Yêu cầu với trợ lý món ăn").fill("Đổi bữa tối");
    await panel.getByRole("button", { name: "Gửi", exact: true }).click();
    await expect(
      map.getByRole("button", { name: /Bún chả cá 2, món mới$/ }),
    ).toBeVisible();
    await expect(pins).toHaveCount(2);
    expect(styleLoads).toBe(loaded);

    await panel.getByRole("button", { name: "Đóng trợ lý món ăn" }).click();
    await expect(pins).toHaveCount(0);
    expect(styleLoads).toBe(loaded);
  });
});
