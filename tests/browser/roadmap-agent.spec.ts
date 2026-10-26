import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  agentConversation,
  agentProposal,
  agentRoadmap,
} from "../fixtures/agent";
import type {
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
let mode: "complete" | "processing" | "unavailable" | "replay" | "conflict" =
  "complete";
let confirmMode: "ok" | "unknown" | "conflict" = "ok";
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

const handler: StubHandler = ({ method, url, body }, send) => {
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
        { role: "assistant", content: "Mình đề xuất món Mì Quảng." },
      ],
    };
    send(200, {
      status: "completed",
      reply: "Mình đề xuất món Mì Quảng.",
      conversationVersion: mode === "replay" ? 1 : conversation.version,
      proposal,
      validation: proposal?.validation ?? null,
      replayed: mode === "replay",
    });
    return true;
  }
  if (path === "/api/v1/agent/conversations/7/confirm" && method === "POST") {
    confirmCalls.push(structuredClone(body as AgentConfirmRequest));
    if (confirmMode === "conflict") {
      conversation.currentProposal = agentProposal({
        status: "invalid",
        validation: {
          errors: ["Giá món đã thay đổi."],
          warnings: [],
          routes: [],
          totalCost: 60000,
        },
      });
      send(
        409,
        conversation.currentProposal.validation,
        "PROPOSAL_NOT_COMMITTABLE",
      );
      return true;
    }
    if (!committedWrites) committedWrites++;
    conversation.currentProposal = agentProposal({ status: "committed" });
    if (confirmMode === "unknown") {
      send(503, null, "SERVICE_UNAVAILABLE");
      return true;
    }
    send(200, {
      roadmapId: 88,
      roadmapVersion: 6,
      committedProposalId: 91,
      itemIds: { r123: 456 },
    });
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
  confirmMode = "ok";
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
  page.getByRole("dialog", { name: "ANGI Trợ lý ăn uống" });
async function open(page: Page) {
  await page
    .getByRole("button", { name: "✦ Trợ lý món ăn", exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
}
async function chat(page: Page, text = "Gợi ý món ăn ở Đà Nẵng") {
  await panel(page).getByLabel("Yêu cầu với trợ lý món ăn").fill(text);
  await panel(page).getByRole("button", { name: "Gửi", exact: true }).click();
}

test("opens lazily, slides over the notebook, keeps the map and restores focus with Escape", async ({
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
    panel(page).getByRole("heading", {
      name: "Bạn muốn khám phá món gì ở Đà Nẵng?",
    }),
  ).toBeVisible();
  expect(await map.boundingBox()).toEqual(before);
  await expect
    .poll(async () => Math.abs((await panel(page).boundingBox())!.x))
    .toBeLessThan(1);
  const frame = await panel(page).boundingBox();
  expect(frame!.x).toBe(0);
  expect(Math.abs(frame!.width - before!.x)).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "✦ Trợ lý món ăn", exact: true }),
  ).toBeFocused();
  await open(page);
  await expect.poll(() => getCalls).toBe(1);
  expect(openCalls).toBe(1);
});

test("previews the real response, selects a specific item and saves exactly the confirmed proposal", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  await expect(
    panel(page).getByRole("button", { name: /Ngày 1.*Mì Quảng/ }),
  ).toBeVisible();
  await expect(
    panel(page)
      .getByText("Thời gian di chuyển chỉ là ước tính.", { exact: true })
      .first(),
  ).toBeVisible();
  expect(detailCalls).toBe(1);
  expect(confirmCalls).toHaveLength(0);
  await panel(page)
    .getByRole("button", { name: /Ngày 1.*Mì Quảng/ })
    .click();
  await chat(page, "Đổi sang món khác");
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1].selectedItemKey).toBe("r123");
  expect(messageCalls[1].expectedConversationVersion).toBe(3);
  await panel(page)
    .getByRole("button", { name: "Xác nhận lưu vào lộ trình", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Lưu bản xem trước vào lộ trình?",
  });
  await expect(dialog).toBeVisible();
  expect(confirmCalls).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  await expect(
    panel(page).getByText("Đã lưu thay đổi vào lộ trình.", { exact: true }),
  ).toBeVisible();
  expect(confirmCalls).toEqual([{ proposalId: 91, proposalVersion: 1 }]);
  expect(committedWrites).toBe(1);
  await expect.poll(() => detailCalls).toBe(2);
});

test("202 processing is preserved, polls GET and never repeats the message POST", async ({
  page,
}) => {
  mode = "processing";
  await open(page);
  const result = page.waitForResponse((r) => r.url().endsWith("/messages"));
  await chat(page);
  expect((await result).status()).toBe(202);
  await expect(
    panel(page).getByRole("button", { name: "Gửi", exact: true }),
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
  await expect(
    panel(page).getByRole("button", {
      name: "Xác nhận lưu vào lộ trình",
      exact: true,
    }),
  ).toBeEnabled();
  expect(messageCalls).toHaveLength(1);
  expect(openCalls).toBe(1);
});

test("a transport retry preserves the numeric message ID, version, content and selected options", async ({
  page,
}) => {
  mode = "unavailable";
  await open(page);
  await chat(page, "Tìm món ăn nhẹ");
  await expect(
    panel(page).getByRole("button", { name: "Thử lại đúng tin nhắn" }),
  ).toBeVisible();
  await panel(page)
    .getByLabel("Yêu cầu với trợ lý món ăn")
    .fill("Nội dung đã sửa nhưng chưa gửi");
  mode = "complete";
  await panel(page)
    .getByRole("button", { name: "Thử lại đúng tin nhắn" })
    .click();
  await expect.poll(() => getCalls).toBe(1);
  expect(messageCalls).toHaveLength(2);
  expect(messageCalls[1]).toEqual(messageCalls[0]);
  expect(Number.isSafeInteger(messageCalls[0].clientMessageId)).toBe(true);
});

test("a replay loads the current state instead of overwriting it with an old proposal", async ({
  page,
}) => {
  mode = "replay";
  await open(page);
  await chat(page);
  await expect(
    panel(page).getByText("Bản xem trước · V2", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("Bản xem trước · V1", { exact: true }),
  ).toHaveCount(0);
});

test("a conversation conflict refreshes the authoritative version without automatically resending", async ({
  page,
}) => {
  mode = "conflict";
  await open(page);
  await chat(page);
  await expect(panel(page).getByText(/Hội thoại đã thay đổi/)).toBeVisible();
  await expect.poll(() => getCalls).toBe(1);
  expect(messageCalls).toHaveLength(1);
  mode = "complete";
  await chat(page, "Tôi đã xem lại, hãy tiếp tục");
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1].expectedConversationVersion).toBe(9);
});

test("unknown confirm results retry the same proposal and do not save twice", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  confirmMode = "unknown";
  await panel(page)
    .getByRole("button", { name: "Xác nhận lưu vào lộ trình", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Lưu bản xem trước vào lộ trình?" })
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "Kiểm tra lại lần lưu" }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "Gửi", exact: true }),
  ).toBeDisabled();
  confirmMode = "ok";
  await panel(page)
    .getByRole("button", { name: "Kiểm tra lại lần lưu" })
    .click();
  await expect(
    panel(page).getByText("Đã lưu thay đổi vào lộ trình.", { exact: true }),
  ).toBeVisible();
  expect(confirmCalls).toHaveLength(2);
  expect(confirmCalls[1]).toEqual(confirmCalls[0]);
  expect(committedWrites).toBe(1);
});

test("a rejected confirm shows validation and blocks stale or invalid previews", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  confirmMode = "conflict";
  await panel(page)
    .getByRole("button", { name: "Xác nhận lưu vào lộ trình", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Lưu bản xem trước vào lộ trình?" })
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  await expect(
    panel(page).getByText("Giá món đã thay đổi.", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("button", {
      name: "Xác nhận lưu vào lộ trình",
      exact: true,
    }),
  ).toBeDisabled();
  expect(committedWrites).toBe(0);
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
    panel(page).getByRole("button", { name: "Ràng buộc", exact: true }),
  ).toBeEnabled();
  await panel(page)
    .getByRole("button", { name: "Ràng buộc", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Xác nhận ràng buộc với trợ lý",
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
  await expect(
    panel(page).getByRole("button", { name: /Ngày 1.*Mì Quảng/ }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: /Ngày 1.*Mì Quảng/ })
    .scrollIntoViewIfNeeded();
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
    await expect
      .poll(async () => Math.abs((await panel(page).boundingBox())!.x))
      .toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const box = (await panel(page).boundingBox())!;
    expect(box.height).toBe(930);
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

test("alternative, discard and reset use the designed commands and require confirmation for discarding", async ({
  page,
}) => {
  await open(page);
  await chat(page);
  await panel(page)
    .getByRole("button", { name: /Ngày 1.*Mì Quảng/ })
    .click();
  await panel(page)
    .getByRole("button", {
      name: "Tìm phương án khác cho món đã chọn",
      exact: true,
    })
    .click();
  await expect.poll(() => messageCalls.length).toBe(2);
  expect(messageCalls[1]).toMatchObject({
    command: "alternative",
    selectedItemKey: "r123",
  });
  await panel(page)
    .getByRole("button", { name: "Bỏ bản nháp", exact: true })
    .click();
  const discard = page.getByRole("dialog", { name: "Bỏ bản nháp hiện tại?" });
  await expect(discard).toBeVisible();
  expect(messageCalls).toHaveLength(2);
  await discard.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect.poll(() => messageCalls.length).toBe(3);
  expect(messageCalls[2].command).toBe("discard");
  await panel(page)
    .getByRole("button", { name: "Làm mới", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Làm mới ngữ cảnh trợ lý?" })
    .getByRole("button", { name: "Xác nhận", exact: true })
    .click();
  await expect.poll(() => messageCalls.length).toBe(4);
  expect(messageCalls[3].command).toBe("reset");
  expect(confirmCalls).toHaveLength(0);
});

test("an expired preview stays visible but cannot be confirmed", async ({
  page,
}) => {
  conversation.currentProposal = agentProposal({
    expiresAt: "2020-01-01T00:00:00Z",
  });
  await open(page);
  await expect(
    panel(page).getByRole("button", {
      name: "Xác nhận lưu vào lộ trình",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    panel(page).getByText(
      "Bản xem trước đã hết hạn. Hãy yêu cầu phương án mới.",
      { exact: true },
    ),
  ).toBeVisible();
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

const prompts = ["Gợi ý bữa trưa theo ngân sách"];

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
  await panel(page)
    .getByRole("button", { name: "Xác nhận lưu vào lộ trình", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Lưu bản xem trước vào lộ trình?" })
    .getByRole("button", { name: "Xác nhận lưu", exact: true })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "Tải lại lộ trình", exact: true }),
  ).toBeVisible();
  expect(confirmCalls).toHaveLength(1);
  failReload = false;
  await panel(page)
    .getByRole("button", { name: "Tải lại lộ trình", exact: true })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "Tải lại lộ trình", exact: true }),
  ).toHaveCount(0);
  expect(confirmCalls).toHaveLength(1);
  expect(committedWrites).toBe(1);
});
