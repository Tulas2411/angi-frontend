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
} from "@/features/roadmaps/agent-rules";
import { agentService } from "@/features/roadmaps/agent-service";
import { agentOperation } from "@/shared/api/agent-proxy";
import { ApiError } from "@/shared/api/error";
import { agentConversation, agentProposal } from "./fixtures/agent";

afterEach(() => vi.unstubAllGlobals());
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
