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
      .getByRole("button", { name: "Trợ lý món ăn", exact: true })
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
    const panel = page.getByRole("dialog", { name: "Trợ lý món ăn" });
    await expect(
      panel.locator(".agent-proposal-item", { hasText: "Bún chả cá 1" }),
    ).toHaveAttribute("data-selected", "true");

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

  test("colors preview pins by day, and a new dish keeps its day's color", async ({
    page,
  }) => {
    stub.reset();
    const proposal = preview();
    const [first, second] = proposal.snapshot.items;
    const added = (itemKey: string, dayNumber: number, offset: number) => ({
      ...first,
      itemKey,
      dayNumber,
      dishId: 300 + dayNumber,
      dishName: `Món ngày ${dayNumber}`,
      restaurantName: `Quán ngày ${dayNumber}`,
      latitude: 16.05 + offset,
      longitude: 108.2 + offset,
    });
    const dayTwo = added("day-2", 2, 0.03);
    const dayThree = added("day-3", 3, 0.05);
    proposal.snapshot.state.numDays = 3;
    proposal.snapshot.items.push(dayTwo, dayThree);
    proposal.snapshot.changes = [
      { type: "add", targetItemKey: second.itemKey, item: second },
      { type: "add", targetItemKey: dayTwo.itemKey, item: dayTwo },
      { type: "add", targetItemKey: dayThree.itemKey, item: dayThree },
    ];
    conversation = agentConversation({ currentProposal: proposal });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubMapboxRendering(page);
    await loginAs(page, "traveler");
    await page.goto("/roadmaps/88");
    const map = page.getByRole("region", { name: "Bản đồ lộ trình" });
    await expect(map).toHaveAttribute("data-ready", "true");
    await page
      .getByRole("button", { name: "Trợ lý món ăn", exact: true })
      .click();
    const pins = map.locator(".roadmap-map-pin-preview");
    await expect(pins).toHaveCount(4);

    const fill = (name: RegExp) =>
      map
        .getByRole("button", { name })
        // The pin is an SVG drop filled with currentColor: the day colour is the button's color.
        .evaluate((pin) => getComputedStyle(pin).color);
    const dayOne = await fill(/ngày 1: Bún chả cá 1, món mới$/);
    expect(await fill(/ngày 1: Mì Quảng$/)).toBe(dayOne);
    const colors = [
      dayOne,
      await fill(/ngày 2: Món ngày 2, món mới$/),
      await fill(/ngày 3: Món ngày 3, món mới$/),
    ];
    expect(new Set(colors).size).toBe(3);
    await page.screenshot({
      path: "artifacts/roadmap-agent/preview-day-colors-1440.png",
    });

    const panel = page.getByRole("dialog", { name: "Trợ lý món ăn" });
    // The draft sits folded in its card at the foot of the chat (#118): open it to switch days.
    const draftCard = panel.locator(".agent-draft-tab");
    if ((await draftCard.getAttribute("aria-expanded")) !== "true")
      await draftCard.click();
    await expect(
      panel.getByRole("region", { name: "Lịch nháp của trợ lý" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Ngày 3", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "Ngày 3", exact: true }),
    ).toHaveCSS("background-color", colors[2]);
    expect(
      await panel
        .locator(".agent-day-title")
        .evaluate(
          (title) => getComputedStyle(title, "::before").backgroundColor,
        ),
    ).toBe(colors[2]);
    await page.screenshot({
      path: "artifacts/roadmap-agent/preview-day-colors-day3-1440.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.screenshot({
      path: "artifacts/roadmap-agent/preview-card-390.png",
    });
  });
});
