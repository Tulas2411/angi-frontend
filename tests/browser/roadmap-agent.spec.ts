import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  agentConversation,
  agentProposal,
  agentRoadmap,
} from "../fixtures/agent";
import type {
  AgentCommit,
  AgentConfirmRequest,
  AgentConversation,
  AgentMessageRequest,
} from "../../src/features/roadmaps/agent-types";
import {
  loginAs,
  startAccountStub,
  stopAccountStub,
  type AccountStub,
  type StubHandler,
} from "./account-api-stub";

let stub: AccountStub;
let conversation: AgentConversation;
let mode:
  | "complete"
  | "processing"
  | "unavailable"
  | "transport"
  | "replay"
  | "conflict"
  | "hold" = "complete";
let abortedMessages = 0;
let replyText = "Mình đề xuất món Mì Quảng.";
let messageCalls: AgentMessageRequest[] = [];
let confirmCalls: AgentConfirmRequest[] = [];
let impressions: { requestId: string; dishIds: number[] }[] = [];
let openCalls = 0,
  getCalls = 0,
  detailCalls = 0,
  processingReads = 0,
  committedWrites = 0;
let openError: string | null = null;
let getError: string | null = null;
let failReload = false;
let chatCommit: AgentCommit | null = null;

const handler: StubHandler = ({ method, url, body, onAbort }, send) => {
  const path = new URL(url, "http://stub").pathname;
  if (method === "GET" && path === "/api/v1/roadmaps/88") {
    detailCalls++;
    if (failReload && committedWrites > 0) {
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    send(200, agentRoadmap());
    return true;
  }
  if (method === "POST" && path === "/api/v1/impressions") {
    impressions.push(body as (typeof impressions)[number]);
    send(202, { accepted: true });
    return true;
  }
  if (path === "/api/v1/agent/conversations" && method === "POST") {
    openCalls++;
    expect(body).toEqual({ roadmapId: 88 });
    if (openError) send(404, null, openError);
    else send(201, conversation);
    return true;
  }
  if (path === "/api/v1/agent/conversations/7" && method === "GET") {
    getCalls++;
    if (getError) {
      send(410, null, getError);
      return true;
    }
    if (conversation.processing && ++processingReads >= 2)
      conversation = {
        ...conversation,
        processing: false,
        version: 3,
        currentProposal: agentProposal(),
        messages: [
          { role: "user", content: messageCalls[0].content },
          { role: "assistant", content: "Đây là lịch trình đã hoàn tất." },
        ],
      };
    send(200, conversation);
    return true;
  }
  if (path === "/api/v1/agent/conversations/7/messages" && method === "POST") {
    const request = body as AgentMessageRequest;
    messageCalls.push(structuredClone(request));
    if (mode === "hold") {
      onAbort(() => abortedMessages++);
      return true;
    }
    if (mode === "transport") {
      send(502, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    if (mode === "unavailable") {
      send(503, null, "AGENT_UNAVAILABLE");
      return true;
    }
    if (mode === "conflict") {
      conversation.version = 9;
      send(409, null, "CONVERSATION_VERSION_CONFLICT");
      return true;
    }
    if (mode === "processing") {
      conversation = { ...conversation, version: 2, processing: true };
      send(202, {
        status: "processing",
        reply: "",
        conversationVersion: 2,
        proposal: null,
        validation: null,
        replayed: false,
      });
      return true;
    }
    const proposal =
      request.command === "discard" || request.command === "reset"
        ? null
        : agentProposal();
    conversation = {
      ...conversation,
      version: conversation.version + 2,
      state: request.confirmedState ?? conversation.state,
      currentProposal:
        mode === "replay" ? agentProposal({ version: 2 }) : proposal,
      messages: [
        ...conversation.messages,
        { role: "user", content: request.content },
        { role: "assistant", content: replyText },
      ],
    };
    if (chatCommit) committedWrites++;
    send(200, {
      status: "completed",
      reply: replyText,
      conversationVersion: mode === "replay" ? 1 : conversation.version,
      proposal,
      validation: proposal?.validation ?? null,
      replayed: mode === "replay",
      commit: chatCommit,
    });
    return true;
  }
  if (path === "/api/v1/agent/conversations/7/confirm" && method === "POST") {
    // The panel saves through chat; a call here fails the assertions on confirmCalls.
    confirmCalls.push(structuredClone(body as AgentConfirmRequest));
    send(404, null, "ROUTE_NOT_FOUND");
    return true;
  }
  return false;
};

test.beforeAll(async () => {
  stub = await startAccountStub(5164, handler);
});
test.afterAll(async () => stopAccountStub(stub));
test.beforeEach(async ({ page, context }) => {
  stub.reset();
  conversation = agentConversation();
  mode = "complete";
  abortedMessages = 0;
  replyText = "Mình đề xuất món Mì Quảng.";
  messageCalls = [];
  confirmCalls = [];
  impressions = [];
  openCalls = 0;
  getCalls = 0;
  detailCalls = 0;
  processingReads = 0;
  committedWrites = 0;
  openError = null;
  getError = null;
  failReload = false;
  chatCommit = null;
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      return route.abort();
    return route.continue();
  });
  await page.route("**/api/locations/**", (route) =>
    route.fulfill({
      json: { success: true, data: [{ code: 48, name: "Thành phố Đà Nẵng" }] },
    }),
  );
  await loginAs(page, "traveler");
  await page.goto("/roadmaps/88");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Đà Nẵng",
  );
});
const panel = (page: Page) =>
  page.getByRole("dialog", { name: "Trợ lý món ăn" });
const dish = (page: Page, itemKey: string) =>
  panel(page).locator(`[data-item-key="${itemKey}"]`);
const committed: AgentCommit = {
  roadmapId: 88,
  roadmapVersion: 6,
  committedProposalId: 91,
  itemIds: { r123: 456 },
};
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Trợ lý món ăn", exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
}
async function chat(page: Page, text = "Gợi ý món ăn ở Đà Nẵng") {
  await panel(page).getByLabel("Yêu cầu với trợ lý món ăn").fill(text);
  await panel(page).getByRole("button", { name: "Gửi", exact: true }).click();
}

test("the sidebar button opens the full panel beside the map, lazily, and Escape restores focus", async ({
  page,
}) => {
  expect(openCalls).toBe(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const map = page.getByRole("region", { name: "Bản đồ lộ trình" });
  const before = await map.boundingBox();
  const result = page.waitForResponse(
    (r) =>
      r.url().endsWith("/agent/conversations") &&
      r.request().method() === "POST",
  );
  await open(page);
  expect((await result).status()).toBe(201);
  await expect(
    panel(page).getByRole("heading", { name: "Chưa biết ăn gì? Thử hỏi:" }),
  ).toBeVisible();
  expect(await map.boundingBox()).toEqual(before);
  // It covers everything left of the map, site header and sidebar included.
  await expect
    .poll(async () => {
      const box = (await panel(page).boundingBox())!;
      return [box.x, box.y, box.height];
    })
    .toEqual([0, 0, 1000]);
  const frame = await panel(page).boundingBox();
  expect(Math.abs(frame!.width - before!.x)).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Trợ lý món ăn", exact: true }),
  ).toBeFocused();
  await open(page);
  await expect.poll(() => getCalls).toBe(1);
  expect(openCalls).toBe(1);
});

test("a draft is read in the panel and changed and saved only by chatting", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  await expect(dish(page, "r123")).toContainText("Mì Quảng");
  await expect(
    panel(page)
      .getByText("Thời gian di chuyển chỉ là ước tính.", { exact: true })
      .first(),
  ).toBeVisible();
  // The draft offers no actions of its own, and its dishes are not controls.
  for (const name of ["Thêm vào lộ trình", "Đổi món khác", "Bỏ bản nháp"])
    await expect(panel(page).getByRole("button", { name })).toHaveCount(0);
  await expect(dish(page, "r123").getByRole("button")).toHaveCount(0);
  await expect(dish(page, "r123")).not.toHaveRole("button");
  await expect(panel(page)).toContainText("lưu lịch này");
  expect(detailCalls).toBe(1);

  await chat(page, "Đổi sang món khác");
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1].selectedItemKey).toBeUndefined();
  expect(messageCalls[1].expectedConversationVersion).toBe(3);

  chatCommit = committed;
  await chat(page, "lưu lịch này");
  await expect(
    panel(page).getByText("Đã lưu thay đổi vào lộ trình.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => detailCalls).toBe(2);
  expect(confirmCalls).toHaveLength(0);
});

test("202 processing is preserved, polls GET and never repeats the message POST", async ({
  page,
}) => {
  mode = "processing";
  await open(page);
  const result = page.waitForResponse((r) => r.url().endsWith("/messages"));
  await chat(page);
  expect((await result).status()).toBe(202);
  // The request has ended, so nothing is left that a stop button could cancel.
  await expect(
    panel(page).getByRole("button", { name: "Đang xử lý", exact: true }),
  ).toBeDisabled();
  await expect(
    panel(page).getByText("Đây là lịch trình đã hoàn tất.", { exact: true }),
  ).toBeVisible();
  expect(messageCalls).toHaveLength(1);
  expect(getCalls).toBeGreaterThanOrEqual(2);
});

test("closing during processing resumes with GET and leaves the composer usable after completion", async ({
  page,
}) => {
  mode = "processing";
  await open(page);
  await chat(page);
  await expect.poll(() => messageCalls.length).toBe(1);
  await panel(page).getByRole("button", { name: "Đóng trợ lý món ăn" }).click();
  conversation = {
    ...conversation,
    processing: false,
    version: 3,
    currentProposal: agentProposal(),
  };
  await open(page);
  await expect(dish(page, "r123")).toBeVisible();
  await panel(page).getByLabel("Yêu cầu với trợ lý món ăn").fill("Câu tiếp");
  await expect(
    panel(page).getByRole("button", { name: "Gửi", exact: true }),
  ).toBeEnabled();
  expect(messageCalls).toHaveLength(1);
  expect(openCalls).toBe(1);
});

test("an unknown outcome replays the same message under the current version", async ({
  page,
}) => {
  mode = "transport";
  await open(page);
  await chat(page, "Tìm món ăn nhẹ");
  const retry = panel(page).getByRole("button", { name: "Thử lại" });
  await expect(retry).toBeVisible();
  await expect(
    panel(page).getByText("Tìm món ăn nhẹ", { exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByLabel("Yêu cầu với trợ lý món ăn")
    .fill("Nội dung đã sửa nhưng chưa gửi");
  mode = "complete";
  await retry.click();
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1]).toEqual(messageCalls[0]);
  expect(Number.isSafeInteger(messageCalls[0].clientMessageId)).toBe(true);
});

test("the composer empties on send and a failure needs no extra step", async ({
  page,
}) => {
  mode = "unavailable";
  await open(page);
  const input = panel(page).getByLabel("Yêu cầu với trợ lý món ăn");
  await input.fill("huong dan toi");
  await input.press("Enter");
  await expect(input).toHaveValue("huong dan toi");
  await expect(panel(page).getByRole("alert")).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "Thử lại" }),
  ).toHaveCount(0);
  await expect(
    panel(page).getByRole("button", { name: "Kiểm tra hội thoại" }),
  ).toHaveCount(0);
  mode = "complete";
  await panel(page).getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
  expect(messageCalls).toHaveLength(2);
  expect(messageCalls[1].clientMessageId).not.toBe(
    messageCalls[0].clientMessageId,
  );
});

test("planning questions offer one-tap answers chosen by the backend stage", async ({
  page,
}) => {
  await page.context().grantPermissions(["geolocation"]);
  await page
    .context()
    .setGeolocation({ latitude: 21.0278, longitude: 105.8342 });
  conversation = {
    ...conversation,
    state: { ...conversation.state, province: null, planningIntake: "details" },
  };
  await open(page);
  await panel(page)
    .getByRole("button", { name: "Dùng vị trí hiện tại" })
    .click();
  await expect.poll(() => messageCalls.length).toBe(1);
  expect(messageCalls[0].confirmedState).toMatchObject({
    originMode: "gps",
    originLatitude: 21.0278,
    originLongitude: 105.8342,
    radiusKm: null,
  });
});

test("asking for somewhere nearby shares the position at any point in the conversation", async ({
  page,
}) => {
  await page.context().grantPermissions(["geolocation"]);
  await page
    .context()
    .setGeolocation({ latitude: 21.0278, longitude: 105.8342 });
  // The place is already known, so no one-tap location answer is on offer.
  conversation = { ...conversation, currentProposal: agentProposal() };
  await open(page);
  await expect(
    panel(page).getByRole("button", { name: "Dùng vị trí hiện tại" }),
  ).toHaveCount(0);
  await chat(page, "tìm quán gần tôi");
  await expect.poll(() => messageCalls.length).toBe(1);
  expect(messageCalls[0].confirmedState).toMatchObject({
    originMode: "gps",
    originLatitude: 21.0278,
    radiusKm: 10,
  });
});

test("a refused position says why and spends no message the model could not answer", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _: unknown,
          fail: (error: { code: number }) => void,
        ) => fail({ code: 2 }),
      },
    });
  });
  await open(page);
  const input = panel(page).getByLabel("Yêu cầu với trợ lý món ăn");
  await input.fill("tìm quán gần tôi");
  await panel(page).getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(panel(page)).toContainText("dịch vụ vị trí");
  await expect(input).toHaveValue("tìm quán gần tôi");
  expect(messageCalls).toHaveLength(0);
});

test("a dish shows why it was suggested and the day ends with its conclusion", async ({
  page,
}) => {
  const proposal = agentProposal();
  proposal.snapshot.dishNotes = [
    {
      dishId: 105,
      intro: "Sợi mì vàng ăn cùng nước dùng sánh.",
      reason: "Hợp bữa trưa nhẹ mà vẫn no.",
    },
  ];
  proposal.snapshot.daySummaries = [
    { dayNumber: 1, summary: "Một ngày nhẹ nhàng, đậm vị miền Trung." },
  ];
  conversation = { ...conversation, currentProposal: proposal };
  await open(page);
  await expect(dish(page, "r123")).toContainText(
    "Sợi mì vàng ăn cùng nước dùng sánh.",
  );
  await expect(dish(page, "r123")).toContainText("Hợp bữa trưa nhẹ mà vẫn no.");
  await expect(panel(page).locator(".agent-day-summary")).toHaveText(
    "Một ngày nhẹ nhàng, đậm vị miền Trung.",
  );
});

test("a draft with no wording from the backend still shows its dishes", async ({
  page,
}) => {
  conversation = { ...conversation, currentProposal: agentProposal() };
  await open(page);
  await expect(dish(page, "r123")).toContainText("Mì Quảng");
  await expect(panel(page).locator(".agent-proposal-intro")).toHaveCount(0);
  await expect(panel(page).locator(".agent-day-summary")).toHaveCount(0);
});

test("the distance is shown between dishes rather than as a day total", async ({
  page,
}) => {
  const proposal = agentProposal();
  const [first] = proposal.snapshot.items;
  proposal.snapshot.items.push({
    ...first,
    itemKey: "r200",
    mealSlot: "dinner",
    dishName: "Bún chả cá",
    latitude: 16.07,
    longitude: 108.22,
  });
  proposal.validation.routes = [
    {
      dayNumber: 1,
      isEstimated: false,
      originSkipped: false,
      legs: [{ distanceMeters: 2500, durationSeconds: 600 }],
      totalDistanceMeters: 2500,
      totalDurationSeconds: 600,
    },
  ];
  conversation = { ...conversation, currentProposal: proposal };
  await open(page);
  await expect(panel(page).locator(".agent-leg")).toHaveCount(1);
  await expect(panel(page).locator(".agent-leg")).toContainText("2,5 km");
  await expect(panel(page)).not.toContainText("Cả ngày");
});

test("a replay loads the current state instead of overwriting it with an old proposal", async ({
  page,
}) => {
  mode = "replay";
  await open(page);
  await chat(page);
  await expect(
    panel(page).locator('.agent-proposal[data-version="2"]'),
  ).toBeVisible();
  await expect(
    panel(page).locator('.agent-proposal[data-version="1"]'),
  ).toHaveCount(0);
});

test("a conversation conflict refreshes the authoritative version without automatically resending", async ({
  page,
}) => {
  mode = "conflict";
  await open(page);
  await chat(page);
  await expect(
    panel(page).getByText(/Hội thoại vừa được cập nhật/),
  ).toBeVisible();
  await expect.poll(() => getCalls).toBe(1);
  expect(messageCalls).toHaveLength(1);
  mode = "complete";
  await chat(page, "Tôi đã xem lại, hãy tiếp tục");
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1].expectedConversationVersion).toBe(9);
});

test("reopens the saved conversation reference after page reload and recovers from expiry explicitly", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  await page.reload();
  await open(page);
  await expect(
    panel(page).getByText("Mình đề xuất món Mì Quảng.", { exact: true }),
  ).toBeVisible();
  expect(openCalls).toBe(1);
  getError = "CONVERSATION_EXPIRED";
  await panel(page).getByRole("button", { name: "Đóng trợ lý món ăn" }).click();
  await open(page);
  await expect(panel(page).getByText(/Hội thoại đã hết hạn/)).toBeVisible();
  getError = null;
  conversation = agentConversation();
  await panel(page).getByRole("button", { name: "Mở hội thoại mới" }).click();
  await expect.poll(() => openCalls).toBe(2);
});

test("confirms budget edits on a modal and preserves catalog filters and origin", async ({
  page,
}) => {
  await open(page);
  await expect(
    panel(page).getByRole("button", {
      name: "Điều kiện chuyến đi",
      exact: true,
    }),
  ).toBeEnabled();
  await panel(page)
    .getByRole("button", { name: "Điều kiện chuyến đi", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Xác nhận điều kiện chuyến đi",
  });
  await dialog
    .getByRole("checkbox", {
      name: "Không giới hạn ngân sách (xóa mức đang đặt)",
    })
    .check();
  expect(messageCalls).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Xác nhận và gửi", exact: true })
    .click();
  await expect.poll(() => messageCalls.length).toBe(1);
  expect(messageCalls[0].confirmedState).toMatchObject({
    budgetAmount: null,
    budgetUnrestricted: true,
    tagIds: [1],
    excludeTagIds: [2],
    originMode: "none",
  });
});

test("only visible recommended items generate grouped impressions and null request IDs are ignored", async ({
  page,
}) => {
  const proposal = agentProposal();
  proposal.snapshot.items.push({
    ...proposal.snapshot.items[0],
    itemKey: "r124",
    dishId: 106,
    requestId: null,
    dishName: "Món không có requestId",
  });
  conversation = {
    ...conversation,
    currentProposal: proposal,
    messages: [
      { role: "assistant", content: "Đây là hai món trong bản nháp." },
    ],
  };
  await open(page);
  await expect(dish(page, "r123")).toBeVisible();
  await dish(page, "r123").scrollIntoViewIfNeeded();
  await expect.poll(() => impressions.length, { timeout: 10000 }).toBe(1);
  expect(impressions[0]).toMatchObject({
    requestId: "c701d061-7199-4ebb-884c-f410e3e71706",
    dishIds: [105],
  });
  await panel(page).getByRole("button", { name: "Đóng trợ lý món ăn" }).click();
  await open(page);
  await page.waitForTimeout(3000);
  expect(impressions).toHaveLength(1);
});

test("missing backend APIs show an explicit error rather than fabricated replies", async ({
  page,
}) => {
  openError = "ROUTE_NOT_FOUND";
  await open(page);
  await expect(
    panel(page).getByText("Backend hiện chưa cung cấp API Trợ lý món ăn.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "Gửi", exact: true }),
  ).toBeDisabled();
  expect(messageCalls).toHaveLength(0);
});

test("the map's bubble opens the small popup, which stays small until the traveler expands it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const bubble = page.getByRole("button", { name: "Mở trợ lý món ăn" });
  await bubble.click();
  await expect(panel(page)).toHaveAttribute("data-mode", "popup");
  await expect(bubble).toHaveCount(0);
  // Anchored to the lower right corner, with the page behind it still usable.
  await expect
    .poll(async () => {
      const box = (await panel(page).boundingBox())!;
      return [box.x + box.width, box.y + box.height, box.width, box.height];
    })
    .toEqual([1424, 984, 480, 560]);
  await expect(page.locator(".roadmap-detail-main")).not.toHaveAttribute(
    "inert",
  );
  await page.screenshot({
    path: "artifacts/roadmap-agent/assistant-popup-1440.png",
  });

  // A suggestion is sent as a message, and a new draft does not change the size.
  await panel(page)
    .getByRole("button", { name: prompts[0], exact: true })
    .click();
  await expect.poll(() => messageCalls.length).toBe(1);
  expect(messageCalls[0]).toMatchObject({
    content: prompts[0],
    command: "chat",
  });
  await expect(dish(page, "r123")).toBeVisible();
  await expect(panel(page)).toHaveAttribute("data-mode", "popup");

  await panel(page).getByRole("button", { name: "Mở rộng trợ lý" }).click();
  await expect(panel(page)).toHaveAttribute("data-mode", "expanded");
  await panel(page).getByRole("button", { name: "Thu về cửa sổ nhỏ" }).click();
  await expect(panel(page)).toHaveAttribute("data-mode", "popup");
  await page.keyboard.press("Escape");
  await expect(bubble).toBeFocused();
});

test("the stop button cancels the running turn all the way to the backend", async ({
  page,
}) => {
  mode = "hold";
  await open(page);
  const send = panel(page).getByRole("button", { name: "Gửi", exact: true });
  const input = panel(page).getByLabel("Yêu cầu với trợ lý món ăn");
  await expect(send).toHaveAttribute("data-state", "empty");
  await input.fill("Gợi ý món ăn ở Đà Nẵng");
  await expect(send).toHaveAttribute("data-state", "ready");
  await send.click();

  const stop = panel(page).getByRole("button", { name: "Dừng trả lời" });
  await expect(stop).toBeEnabled();
  await expect(
    panel(page).getByRole("status").getByText("Trợ lý đang trả lời"),
  ).toBeVisible();
  // The avatar's label stays in the middle of its circle.
  const offCenter = await panel(page)
    .locator(".agent-mark")
    .first()
    .evaluate((element) => {
      const circle = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const label = range.getBoundingClientRect();
      return Math.abs(
        circle.left + circle.width / 2 - (label.left + label.width / 2),
      );
    });
  expect(offCenter).toBeLessThan(1.5);
  await panel(page).screenshot({
    path: "artifacts/roadmap-agent/assistant-thinking.png",
  });
  await expect.poll(() => messageCalls.length).toBe(1);
  // The composer is a round button and stays round.
  const box = (await stop.boundingBox())!;
  expect(box.width).toBe(box.height);

  await stop.click();
  // The proxy hangs up on the backend, which is what makes it cancel the turn.
  await expect.poll(() => abortedMessages).toBe(1);
  await expect(input).toHaveValue("Gợi ý món ăn ở Đà Nẵng");
  await expect(send).toHaveAttribute("data-state", "ready");
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
  await expect(panel(page).locator(".agent-message-user")).toHaveCount(0);

  // Sending again is a new message.
  mode = "complete";
  await send.click();
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1].clientMessageId).not.toBe(
    messageCalls[0].clientMessageId,
  );
});

test("a new reply appears word by word and the stop button shows the rest at once", async ({
  page,
}) => {
  // Long enough that the reveal is still running when the button is pressed.
  replyText = `${"Đây là một câu trả lời khá dài. ".repeat(80)}Hết rồi.`;
  await open(page);
  await chat(page);
  const reply = panel(page).locator(".agent-message-assistant").first();
  await expect(reply).toContainText("Đây là một câu trả lời");
  await expect(reply).not.toContainText("Hết rồi.");
  await panel(page).getByRole("button", { name: "Dừng trả lời" }).click();
  await expect(reply).toContainText("Hết rồi.");
  await expect(
    panel(page).getByRole("button", { name: "Gửi", exact: true }),
  ).toBeVisible();
  await expect(dish(page, "r123")).toBeVisible();
  // Stopping a reply that already exists asks nothing more of the backend.
  expect(messageCalls).toHaveLength(1);
});

test("a reply loaded from history appears at once", async ({ page }) => {
  conversation = {
    ...conversation,
    messages: [{ role: "assistant", content: "Mình đề xuất món Mì Quảng." }],
  };
  await open(page);
  await expect(panel(page).locator(".agent-message-assistant")).toContainText(
    "Mình đề xuất món Mì Quảng.",
  );
  await expect(
    panel(page).getByRole("button", { name: "Dừng trả lời" }),
  ).toHaveCount(0);
});

test("a reply renders lists without HTML and its dish name selects the pin", async ({
  page,
}) => {
  conversation = {
    ...conversation,
    currentProposal: agentProposal(),
    messages: [
      { role: "user", content: "Gợi ý cho mình" },
      {
        role: "assistant",
        content:
          "Có vài lựa chọn **hợp với bạn**:\n- Mì Quảng khoảng 50.000\n- <img src=x onerror=alert(1)>",
      },
    ],
  };
  await open(page);
  const reply = panel(page).locator(".agent-message-assistant");
  await expect(reply.locator("strong")).toHaveText("hợp với bạn");
  await expect(reply.locator("li")).toHaveCount(2);
  await expect(reply.locator("img:not(.agent-mark img)")).toHaveCount(0);
  await expect(reply.locator("li").nth(1)).toHaveText(
    "<img src=x onerror=alert(1)>",
  );
  await reply.getByRole("button", { name: "Mì Quảng", exact: true }).click();
  await expect(dish(page, "r123")).toHaveAttribute("data-selected", "true");
});

test("desktop and mobile match the panel layout without horizontal overflow and honor reduced motion", async ({
  page,
}) => {
  await mkdir("artifacts/roadmap-agent", { recursive: true });
  await open(page);
  await expect(
    panel(page).getByRole("button", { name: prompts[0], exact: true }),
  ).toBeEnabled();
  for (const width of [1713, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 930 });
    // The opening transition moves it vertically, so wait until it has settled at the top.
    await expect
      .poll(async () => {
        const box = (await panel(page).boundingBox())!;
        return [box.x, box.y, box.height];
      })
      .toEqual([0, 0, 930]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = (await panel(page).boundingBox())!;
    if (width <= 900) expect(box.width).toBe(width);
    await panel(page).screenshot({
      path: `artifacts/roadmap-agent/assistant-${width}.png`,
    });
    if (width === 1713)
      await page.screenshot({
        path: "artifacts/roadmap-agent/assistant-with-map-1713.png",
      });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await panel(page).evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe("0s");
});

test("an expired preview stays visible and says it can no longer be saved", async ({
  page,
}) => {
  conversation.currentProposal = agentProposal({
    expiresAt: "2020-01-01T00:00:00Z",
  });
  await open(page);
  await expect(
    panel(page).getByText("Bản nháp đã hết hạn. Hãy yêu cầu phương án mới.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(panel(page)).not.toContainText("lưu lịch này");
  expect(confirmCalls).toHaveLength(0);
});

test("the proxy rejects untrusted origins and other roles before reaching the Agent backend", async ({
  page,
}) => {
  const invalidOrigin = await page.request.post(
    "/api/backend/agent/conversations",
    { data: { roadmapId: 88 }, headers: { Origin: "https://invalid.example" } },
  );
  expect(invalidOrigin.status()).toBe(403);
  await loginAs(page, "owner");
  const denied = await page.request.post("/api/backend/agent/conversations", {
    data: { roadmapId: 88 },
    headers: { Origin: "http://localhost:3001" },
  });
  expect(denied.status()).toBe(403);
  expect(openCalls).toBe(0);
});

const prompts = ["Lộ trình ăn uống 1 ngày ở Đà Nẵng"];

test("a closed conversation offers a new one without editing the saved roadmap", async ({
  page,
}) => {
  conversation.status = "closed";
  await open(page);
  await expect(
    panel(page).getByRole("button", { name: "Mở hội thoại mới", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "Gửi", exact: true }),
  ).toBeDisabled();
  conversation = agentConversation();
  await panel(page)
    .getByRole("button", { name: "Mở hội thoại mới", exact: true })
    .click();
  await expect.poll(() => openCalls).toBe(2);
  expect(confirmCalls).toHaveLength(0);
});

test("a failed RM-03 reload after saving retries only the read and keeps the successful commit", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  failReload = true;
  chatCommit = committed;
  await chat(page, "lưu lịch này");
  await expect(
    panel(page).getByRole("button", { name: "Tải lại lộ trình", exact: true }),
  ).toBeVisible();
  const writes = committedWrites;
  failReload = false;
  await panel(page)
    .getByRole("button", { name: "Tải lại lộ trình", exact: true })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "Tải lại lộ trình", exact: true }),
  ).toHaveCount(0);
  expect(committedWrites).toBe(writes);
  expect(confirmCalls).toHaveLength(0);
});

test("a save said in chat reloads the roadmap and shows the saved state", async ({
  page,
}) => {
  conversation = { ...conversation, currentProposal: agentProposal() };
  chatCommit = committed;
  await open(page);
  const loaded = detailCalls;
  await chat(page, "chốt lịch này");
  await expect(
    panel(page).getByText("Đã lưu thay đổi vào lộ trình.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => detailCalls).toBe(loaded + 1);
  expect(confirmCalls).toHaveLength(0);
});

/** A two-day preview whose second day holds one replaced dish. */
function twoDayProposal() {
  const proposal = agentProposal();
  const [lunch] = proposal.snapshot.items;
  const replaced = {
    ...lunch,
    itemKey: "r200",
    dayNumber: 2,
    dishId: 200,
    dishName: "Bún chả cá",
    restaurantName: "Quán Biển",
    latitude: 16.07,
    longitude: 108.22,
  };
  proposal.snapshot.state.numDays = 2;
  proposal.snapshot.items.push(replaced);
  proposal.snapshot.changes = [
    { type: "replace", targetItemKey: "r200", item: replaced },
  ];
  proposal.validation.routes = [];
  return proposal;
}

test("a question and a warning appear once, not in the message and again in the panel and card", async ({
  page,
}) => {
  const question = "Bạn muốn đổi món nào?";
  const proposal = agentProposal();
  proposal.snapshot.state.pendingQuestion = question;
  conversation = {
    ...conversation,
    state: { ...conversation.state, pendingQuestion: question },
    currentProposal: proposal,
    messages: [{ role: "assistant", content: question }],
  };
  await open(page);
  await expect(panel(page).getByText(question)).toHaveCount(1);
  await expect(
    panel(page).getByText("Thời gian di chuyển chỉ là ước tính."),
  ).toHaveCount(1);
  await expect(panel(page).getByText(/ · V\d/)).toHaveCount(0);
  await expect(panel(page).getByText(/ngữ cảnh|Ràng buộc/)).toHaveCount(0);
});

test("a short reply and the card show the plan once", async ({ page }) => {
  conversation = {
    ...conversation,
    currentProposal: agentProposal(),
    messages: [{ role: "assistant", content: "Xong rồi! Bạn xem nhé." }],
  };
  await open(page);
  await expect(
    panel(page).getByRole("region", { name: "Bản nháp của trợ lý" }),
  ).toHaveCount(1);
  await expect(panel(page).getByText("Mì Quảng")).toHaveCount(1);
});

test("a draft without messages shows the draft instead of the opening suggestions", async ({
  page,
}) => {
  conversation = { ...conversation, currentProposal: agentProposal() };
  await open(page);
  await expect(
    panel(page).getByRole("region", { name: "Bản nháp của trợ lý" }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "Chưa biết ăn gì? Thử hỏi:" }),
  ).toHaveCount(0);
});

test("the map shows the preview while the assistant is open and returns to the saved roadmap after closing or saving", async ({
  page,
}) => {
  const map = page.getByRole("region", { name: "Bản đồ lộ trình" });
  await expect(map).toHaveAttribute("data-preview", "false");
  conversation = { ...conversation, currentProposal: twoDayProposal() };
  await open(page);
  await expect(map).toHaveAttribute("data-preview", "true");
  await expect(map).toContainText("Bản nháp · Ngày 2");
  await expect(map).toContainText("2/2 điểm có tọa độ");
  await expect(
    map.getByRole("button", { name: "Xem vị trí Mì Quảng" }),
  ).toBeVisible();

  await panel(page).getByRole("button", { name: "Đóng trợ lý món ăn" }).click();
  await expect(map).toHaveAttribute("data-preview", "false");
  await open(page);
  await expect(map).toHaveAttribute("data-preview", "true");

  chatCommit = committed;
  await chat(page, "lưu lịch này");
  await expect(
    panel(page).getByText("Đã lưu thay đổi vào lộ trình.", { exact: true }),
  ).toBeVisible();
  await expect(map).toHaveAttribute("data-preview", "false");
});

test("day chips, the card and the map stay in step, and new dishes are marked", async ({
  page,
}) => {
  conversation = { ...conversation, currentProposal: twoDayProposal() };
  await open(page);
  const map = page.getByRole("region", { name: "Bản đồ lộ trình" });
  // A new preview opens on the day it changed.
  const dishOnDay2 = dish(page, "r200");
  await expect(dishOnDay2).toHaveAttribute("data-changed", "true");
  await expect(dishOnDay2).toContainText("Món mới");
  await expect(dish(page, "r123")).toHaveCount(0);

  await panel(page)
    .getByRole("button", { name: "Ngày 1", exact: true })
    .click();
  await expect(map).toContainText("Bản nháp · Ngày 1");
  await expect(dish(page, "r123")).toHaveAttribute("data-changed", "false");

  await map.getByRole("button", { name: "Xem vị trí Bún chả cá" }).click();
  await expect(map).toContainText("Bản nháp · Ngày 2");
  await expect(dishOnDay2).toHaveAttribute("data-selected", "true");
  const card = map.getByRole("region", { name: "Món trong bản nháp" });
  await expect(card).toContainText("Quán Biển");
  await expect(card).toContainText("Món mới trong bản nháp");

  // Choosing a pin shows it on the map; it does not become the subject of the next message.
  await chat(page, "Đổi sang món khác");
  await expect.poll(() => messageCalls.length).toBe(1);
  expect(messageCalls[0].selectedItemKey).toBeUndefined();
});

test("on a phone the panel steps aside to reveal the map and comes back with focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  conversation = { ...conversation, currentProposal: twoDayProposal() };
  await open(page);
  const map = page.getByRole("region", { name: "Bản đồ lộ trình" });
  const toggle = panel(page).getByRole("button", { name: "Xem trên bản đồ" });
  await toggle.click();
  await expect(page.locator("#roadmap-agent-panel")).toBeHidden();
  await expect(map).toBeInViewport();
  const back = page.getByRole("button", { name: "Quay lại trợ lý" });
  await expect(back).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await back.click();
  await expect(panel(page)).toBeVisible();
  await expect(toggle).toBeFocused();
  await expect(back).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toBeHidden();
});
