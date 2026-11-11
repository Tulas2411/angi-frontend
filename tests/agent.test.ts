import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentMessageError,
  canConfirmProposal,
  agentError,
  validationFromError,
  proposalItems,
  newAgentMessageId,
  agentStorageKey,
  storedConversation,
  rememberConversation,
  agentLocationState,
  agentQuickReply,
  agentTurnSettled,
  mentionsCurrentLocation,
  agentLocationProblem,
  agentPromptSuggestions,
  agentReplyBlocks,
  agentRevealNext,
} from "@/features/roadmaps/agent-rules";
import { agentService } from "@/features/roadmaps/agent-service";
import { agentOperation } from "@/shared/api/agent-proxy";
import { ApiError } from "@/shared/api/error";
import { agentConversation, agentProposal } from "./fixtures/agent";

afterEach(() => vi.unstubAllGlobals());
describe("Agent chat presentation rules", () => {
  it("suggests only from what the conversation knows", () => {
    expect(agentPromptSuggestions(agentConversation().state)).toEqual([
      "Lộ trình ăn uống 1 ngày ở Đà Nẵng",
      "Bữa trưa dưới 100.000 VND ở Đà Nẵng",
      "Món đặc trưng nên thử ở Đà Nẵng",
    ]);
    expect(agentPromptSuggestions(null)).toEqual([
      "Lập lịch ăn uống",
      "Bữa trưa hợp ngân sách",
      "Món đặc trưng nên thử",
    ]);
  });
  it("reveals a reply in whole words and finishes in a bounded number of steps", () => {
    const text = "Mình đề xuất món Mì Quảng cho bữa trưa nhé";
    const steps = [];
    for (let shown = 0; shown < text.length;)
      steps.push((shown = agentRevealNext(text, shown)));
    expect(steps.at(-1)).toBe(text.length);
    for (const shown of steps.slice(0, -1)) expect(text[shown]).toBe(" ");
    const long = "từ ".repeat(2000);
    let count = 0;
    for (let shown = 0; shown < long.length; count++)
      shown = agentRevealNext(long, shown);
    expect(count).toBeLessThanOrEqual(50);
  });
  it("reads paragraphs, lists and bold text, and links only the draft's own names", () => {
    const [item] = agentProposal().snapshot.items;
    expect(
      agentReplyBlocks(
        "Có **hai** món:\nxem nhé\n\n- Mì Quảng ngon\n- Phở\n\n1. Quán địa phương\n2) Khác",
        [item],
      ),
    ).toEqual([
      {
        kind: "paragraph",
        lines: [
          [
            { kind: "text", text: "Có " },
            { kind: "strong", text: "hai" },
            { kind: "text", text: " món:" },
          ],
          [{ kind: "text", text: "xem nhé" }],
        ],
      },
      {
        kind: "bullets",
        items: [
          [
            { kind: "item", text: "Mì Quảng", itemKey: "r123" },
            { kind: "text", text: " ngon" },
          ],
          [{ kind: "text", text: "Phở" }],
        ],
      },
      {
        kind: "numbers",
        items: [
          [{ kind: "item", text: "Quán địa phương", itemKey: "r123" }],
          [{ kind: "text", text: "Khác" }],
        ],
      },
    ]);
  });
  it("treats a name's regular-expression characters literally", () => {
    const [item] = agentProposal().snapshot.items;
    const named = { ...item, dishName: "Bún (đặc biệt)", restaurantName: null };
    expect(agentReplyBlocks("Ăn Bún (đặc biệt) nhé", [named])).toEqual([
      {
        kind: "paragraph",
        lines: [
          [
            { kind: "text", text: "Ăn " },
            { kind: "item", text: "Bún (đặc biệt)", itemKey: item.itemKey },
            { kind: "text", text: " nhé" },
          ],
        ],
      },
    ]);
  });
});
describe("Agent request and commit rules", () => {
  it("validates content including whitespace and the 4000-character limit", () => {
    expect(agentMessageError(" \n ")).toBeTruthy();
    expect(agentMessageError("a".repeat(4001))).toBeTruthy();
    expect(agentMessageError("a".repeat(4000))).toBeNull();
  });
  it("only confirms the active ready version without questions, errors or expiry", () => {
    const value = agentConversation({ currentProposal: agentProposal() });
    expect(canConfirmProposal(value, Date.parse("2026-10-26"))).toBe(true);
    for (const status of [
      "invalid",
      "committed",
      "discarded",
      "expired",
      "superseded",
    ] as const)
      expect(
        canConfirmProposal(
          { ...value, currentProposal: agentProposal({ status }) },
          1,
        ),
      ).toBe(false);
    expect(canConfirmProposal({ ...value, processing: true }, 1)).toBe(false);
    expect(canConfirmProposal({ ...value, status: "closed" }, 1)).toBe(false);
    expect(
      canConfirmProposal(
        { ...value, state: { ...value.state, pendingQuestion: "Ngân sách?" } },
        1,
      ),
    ).toBe(false);
    expect(
      canConfirmProposal(
        {
          ...value,
          currentProposal: agentProposal({ expiresAt: "2020-01-01" }),
        },
        Date.now(),
      ),
    ).toBe(false);
    expect(
      canConfirmProposal(
        {
          ...value,
          currentProposal: agentProposal({
            validation: {
              errors: ["Đổi giá"],
              warnings: [],
              routes: [],
              totalCost: 0,
            },
          }),
        },
        1,
      ),
    ).toBe(false);
  });
  it("returns useful errors, Retry-After and safely narrows validation data", () => {
    expect(
      agentError(
        new ApiError(429, "AGENT_RATE_LIMITED", "", undefined, null, "30"),
      ),
    ).toContain("30 giây");
    expect(
      agentError(new ApiError(409, "ROADMAP_VERSION_CONFLICT", "")),
    ).toContain("chưa ghi đè");
    expect(
      validationFromError(
        new ApiError(409, "PROPOSAL_NOT_COMMITTABLE", "", undefined, {
          errors: ["Giá đã thay đổi"],
          warnings: [],
          totalCost: 50000,
          routes: [{}],
        }),
      ),
    ).toEqual({
      errors: ["Giá đã thay đổi"],
      warnings: [],
      totalCost: 50000,
      routes: [],
    });
    expect(
      validationFromError(
        new ApiError(409, "PROPOSAL_NOT_COMMITTABLE", "", undefined, {
          errors: [1],
        }),
      ),
    ).toBeNull();
  });
  it("orders backend items without mutating the received snapshot", () => {
    const proposal = agentProposal();
    const item = proposal.snapshot.items[0];
    proposal.snapshot.items = [
      { ...item, itemKey: "second", dayNumber: 2 },
      { ...item, itemKey: "dinner", mealSlot: "dinner" },
      item,
    ];
    expect(proposalItems(proposal).map((entry) => entry.itemKey)).toEqual([
      "r123",
      "dinner",
      "second",
    ]);
    expect(proposal.snapshot.items[0].itemKey).toBe("second");
  });
  it("generates positive numeric safe IDs and stores only a conversation reference scoped to a user", () => {
    expect(Number.isSafeInteger(newAgentMessageId())).toBe(true);
    expect(newAgentMessageId()).toBeGreaterThan(0);
    expect(agentStorageKey(12, 88)).not.toBe(agentStorageKey(13, 88));
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key),
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    rememberConversation("one", 7);
    expect(storedConversation("one")).toBe(7);
    expect(storage.get("one")).toBe("7");
    rememberConversation("one", null);
    expect(storedConversation("one")).toBeNull();
    storage.set("one", "not-an-id");
    expect(storedConversation("one")).toBeNull();
  });
});
describe("Agent chat flow rules", () => {
  it("treats only answered failures as finished, so an unknown outcome keeps its replay", () => {
    expect(agentTurnSettled(new ApiError(503, "AGENT_UNAVAILABLE", ""))).toBe(
      true,
    );
    expect(agentTurnSettled(new ApiError(429, "AGENT_RATE_LIMITED", ""))).toBe(
      true,
    );
    expect(
      agentTurnSettled(new ApiError(409, "CONVERSATION_VERSION_CONFLICT", "")),
    ).toBe(true);
    expect(agentTurnSettled(new ApiError(503, "SERVICE_UNAVAILABLE", ""))).toBe(
      false,
    );
    expect(agentTurnSettled(new ApiError(502, "INVALID_RESPONSE", ""))).toBe(
      false,
    );
    expect(agentTurnSettled(new TypeError("Failed to fetch"))).toBe(false);
  });
  it("recognizes current-location wording with or without accents", () => {
    for (const text of [
      "vị trí hiện tại",
      "vi tri hien tai",
      "Ở GẦN ĐÂY thôi",
      "quanh day",
      "tìm quán gần tôi",
      "ăn gì quanh mình",
      "chỗ mình đang ở",
    ])
      expect(mentionsCurrentLocation(text)).toBe(true);
    for (const text of ["Hà Nội", "vị trí quán", "gần 3 ngày"])
      expect(mentionsCurrentLocation(text)).toBe(false);
  });
  it("offers a quick reply from the backend stage, never over a plan or a closed conversation", () => {
    const base = agentConversation();
    const at = (
      stage: "details" | "preferences" | null,
      province: string | null,
    ) => ({
      ...base,
      currentProposal: null,
      state: { ...base.state, planningIntake: stage, province },
    });
    expect(agentQuickReply(null)).toBeNull();
    expect(agentQuickReply(at("details", null))).toBe("current-location");
    expect(agentQuickReply(at("details", "Hà Nội"))).toBeNull();
    expect(agentQuickReply(at("preferences", "Hà Nội"))).toBe("plan-now");
    expect(agentQuickReply(at(null, null))).toBeNull();
    expect(
      agentQuickReply({ ...at("details", null), status: "expired" }),
    ).toBeNull();
    expect(
      agentQuickReply({
        ...at("details", null),
        currentProposal: agentProposal(),
      }),
    ).toBeNull();
  });
  it("sends coordinates as confirmed state rounded to the backend's precision", () => {
    const state = agentConversation().state;
    expect(agentLocationState(state, 21.02781234, 105.83421234)).toMatchObject({
      originMode: "gps",
      originLatitude: 21.027812,
      originLongitude: 105.834212,
      radiusKm: 10,
      province: state.province,
    });
    expect(
      agentLocationState({ ...state, province: null }, 21, 105).radiusKm,
    ).toBeNull();
  });
  it("names why the browser gave no position", () => {
    expect(agentLocationProblem(1, true)).toContain("chặn quyền");
    expect(agentLocationProblem(2, true)).toContain("dịch vụ vị trí");
    expect(agentLocationProblem(3, true)).toContain("lâu");
    expect(agentLocationProblem(null, true)).toContain("không hỗ trợ");
    expect(agentLocationProblem(1, false)).toContain("HTTPS");
  });
});

describe("Agent API boundary", () => {
  it("allows only the four designed operations and leaves unrelated routes denied", () => {
    expect(agentOperation("POST", "agent/conversations")?.status).toBe(201);
    expect(
      agentOperation("POST", "agent/conversations/7/messages")?.status,
    ).toBe(200);
    expect(
      agentOperation("POST", "agent/conversations/7/confirm"),
    ).toBeTruthy();
    expect(agentOperation("GET", "agent/conversations/7")).toBeTruthy();
    for (const path of [
      "agent/conversations/0",
      "agent/conversations/-7",
      "agent/conversations/7/delete",
      "agent/conversations/7/messages/extra",
      "agent/conversations/7?upstream=evil",
    ])
      expect(agentOperation("GET", path)).toBeNull();
    expect(agentOperation("DELETE", "agent/conversations/7")).toBeNull();
  });
  it("sends the exact wire requests and reads 201, 202 and 200 envelopes", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ success: true, data: agentConversation() }),
            { status: 201 },
          ),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const old = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";
    try {
      expect(await agentService.open(88)).toMatchObject({ conversationId: 7 });
      expect(fetch.mock.calls[0][0]).toBe("/api/backend/agent/conversations");
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
        roadmapId: 88,
      });
      const body = {
        clientMessageId: 1,
        expectedConversationVersion: 1,
        content: "Mì Quảng",
        command: "chat" as const,
      };
      fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { status: "processing" } }),
          { status: 202 },
        ),
      );
      expect(await agentService.message(7, body)).toMatchObject({
        status: "processing",
      });
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(body);
      await agentService.get(7);
      expect(fetch.mock.calls[2][0]).toBe("/api/backend/agent/conversations/7");
      await agentService.confirm(7, { proposalId: 91, proposalVersion: 1 });
      expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({
        proposalId: 91,
        proposalVersion: 1,
      });
    } finally {
      if (old === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = old;
    }
  });
});
