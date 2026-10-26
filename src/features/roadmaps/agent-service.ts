import { api } from "@/shared/api/client";
import type {
  AgentCommit,
  AgentConfirmRequest,
  AgentConversation,
  AgentMessageRequest,
  AgentTurn,
} from "./agent-types";

export const agentService = {
  open: (roadmapId: number) =>
    api.post<AgentConversation>("agent/conversations", { roadmapId }),
  get: (id: number) => api.get<AgentConversation>(`agent/conversations/${id}`),
  message: (id: number, body: AgentMessageRequest) =>
    api.post<AgentTurn>(`agent/conversations/${id}/messages`, body),
  confirm: (id: number, body: AgentConfirmRequest) =>
    api.post<AgentCommit>(`agent/conversations/${id}/confirm`, body),
  impressions: (requestId: string, dishIds: number[]) =>
    api.post<{ accepted: boolean }>("impressions", {
      requestId,
      dishIds,
      shownAt: new Date().toISOString(),
    }),
};
export type AgentService = typeof agentService;
