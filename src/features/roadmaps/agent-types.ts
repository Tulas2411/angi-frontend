import type { MealSlot, RoadmapOriginMode } from "./roadmap-types";

/** AGENT-01..04, API Design v1.8 supplied on 2026-10-26 (DTO rows 349–435). */
export interface AgentState {
  schemaVersion: number;
  province: string | null;
  numDays: number | null;
  title: string;
  startDate: string | null;
  budgetAmount: number | null;
  budgetUnrestricted: boolean;
  maxPricePerMeal: number | null;
  tagIds: number[];
  excludeTagIds: number[];
  originMode: RoadmapOriginMode;
  originLatitude: number | null;
  originLongitude: number | null;
  originLabel: string | null;
  radiusKm: number | null;
  note: string | null;
  pendingQuestion: string | null;
  focusDay: number | null;
  focusMeal: MealSlot | null;
}
export interface AgentItem {
  itemKey: string;
  sourceItemId: number | null;
  dayNumber: number;
  mealSlot: MealSlot;
  sortOrder: number;
  dishId: number;
  requestId: string | null;
  price: number;
  dishName: string | null;
  restaurantName: string | null;
  latitude: number | null;
  longitude: number | null;
}
export interface AgentValidation {
  errors: string[];
  warnings: string[];
  totalCost: number;
  routes: {
    dayNumber: number;
    isEstimated: boolean;
    originSkipped: boolean;
    legs: { distanceMeters: number; durationSeconds: number }[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
  }[];
}
export interface AgentProposal {
  proposalId: number;
  version: number;
  operation: "create" | "update";
  status:
    "ready" | "invalid" | "superseded" | "committed" | "discarded" | "expired";
  snapshot: {
    state: AgentState;
    items: AgentItem[];
    grants: {
      dayNumber: number | null;
      mealSlot: MealSlot | null;
      dishIds: number[];
      requestId: string | null;
      constraints: AgentState;
    }[];
    baseRoadmapId: number | null;
    baseRoadmapVersion: number | null;
    changes:
      | {
          type: "add" | "replace" | "remove" | "move";
          targetItemKey: string | null;
          item: AgentItem | null;
        }[]
      | null;
    scope: { dayNumber: number | null; mealSlot: MealSlot | null } | null;
    retainedItems: AgentItem[] | null;
  };
  validation: AgentValidation;
  expiresAt: string;
}
export interface AgentTranscript {
  role: "user" | "assistant";
  content: string;
}
export interface AgentConversation {
  conversationId: number;
  version: number;
  status: "active" | "closed" | "expired";
  state: AgentState;
  processing: boolean;
  messages: AgentTranscript[];
  currentProposal: AgentProposal | null;
}
export type AgentCommand = "chat" | "alternative" | "discard" | "reset";
export interface AgentMessageRequest {
  clientMessageId: number;
  expectedConversationVersion: number;
  content: string;
  selectedItemKey?: string;
  command?: AgentCommand;
  confirmedState?: AgentState;
}
export interface AgentTurn {
  status: "completed" | "processing";
  reply: string;
  conversationVersion: number;
  proposal: AgentProposal | null;
  validation: AgentValidation | null;
  replayed: boolean;
}
export interface AgentConfirmRequest {
  proposalId: number;
  proposalVersion: number;
}
export interface AgentCommit {
  roadmapId: number;
  roadmapVersion: number;
  committedProposalId: number;
  itemIds: Record<string, number>;
}
