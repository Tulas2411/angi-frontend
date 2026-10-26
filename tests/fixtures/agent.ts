import type {
  AgentConversation,
  AgentProposal,
  AgentState,
} from "../../src/features/roadmaps/agent-types";
import type { RoadmapDetailDto } from "../../src/features/roadmaps/roadmap-types";

/** API Design v1.8 AGENT-01..04 sample fields, isolated from product source. */
export const agentState = (): AgentState => ({
  schemaVersion: 1,
  province: "Đà Nẵng",
  numDays: 1,
  title: "Một ngày ăn uống ở Đà Nẵng",
  startDate: "2026-10-26",
  budgetAmount: 300000,
  budgetUnrestricted: false,
  maxPricePerMeal: 100000,
  tagIds: [1],
  excludeTagIds: [2],
  originMode: "none",
  originLatitude: null,
  originLongitude: null,
  originLabel: null,
  radiusKm: null,
  note: null,
  pendingQuestion: null,
  focusDay: null,
  focusMeal: null,
});
export const agentProposal = (
  patch: Partial<AgentProposal> = {},
): AgentProposal => ({
  proposalId: 91,
  version: 1,
  operation: "update",
  status: "ready",
  expiresAt: "2099-11-02T02:00:00Z",
  snapshot: {
    state: agentState(),
    items: [
      {
        itemKey: "r123",
        sourceItemId: 123,
        dayNumber: 1,
        mealSlot: "lunch",
        sortOrder: 0,
        dishId: 105,
        requestId: "c701d061-7199-4ebb-884c-f410e3e71706",
        price: 50000,
        dishName: "Mì Quảng",
        restaurantName: "Quán địa phương",
        latitude: 16.0544,
        longitude: 108.2022,
      },
    ],
    grants: [],
    baseRoadmapId: 88,
    baseRoadmapVersion: 5,
    changes: [],
    scope: { dayNumber: 1, mealSlot: "lunch" },
    retainedItems: null,
  },
  validation: {
    errors: [],
    warnings: ["Thời gian di chuyển chỉ là ước tính."],
    totalCost: 50000,
    routes: [
      {
        dayNumber: 1,
        isEstimated: true,
        originSkipped: true,
        legs: [],
        totalDistanceMeters: 2500,
        totalDurationSeconds: 600,
      },
    ],
  },
  ...patch,
});
export const agentConversation = (
  patch: Partial<AgentConversation> = {},
): AgentConversation => ({
  conversationId: 7,
  version: 1,
  status: "active",
  state: agentState(),
  processing: false,
  messages: [],
  currentProposal: null,
  ...patch,
});
export const agentRoadmap = (): RoadmapDetailDto => ({
  overview: {
    id: 88,
    title: "Một ngày ăn uống ở Đà Nẵng",
    startDate: "2026-10-26",
    endDate: "2026-10-26",
    numDays: 1,
    budgetAmount: 300000,
    totalEstimatedCost: 0,
    itemCount: 0,
    coverUrl: null,
    originMode: "none",
    originLatitude: null,
    originLongitude: null,
    originLabel: null,
    createdAt: "2026-10-26T02:00:00Z",
    updatedAt: "2026-10-26T02:00:00Z",
  },
  itinerary: [
    {
      dayId: 301,
      dayNumber: 1,
      date: "2026-10-26",
      note: null,
      dayCost: 0,
      items: [],
    },
  ],
  budget: {
    budgetAmount: 300000,
    totalEstimatedCost: 0,
    remaining: 300000,
    isOverBudget: false,
    byDay: [{ dayNumber: 1, cost: 0 }],
    byMealSlot: [],
  },
});
