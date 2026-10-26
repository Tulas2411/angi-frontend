import { ApiError, getErrorMessage } from "@/shared/api/error";
import type {
  AgentConversation,
  AgentProposal,
  AgentValidation,
} from "./agent-types";

export const agentMessageLimit = 4000;
export const agentPollMs = 2000;
export const agentPollLimitMs = 90000;

export function agentMessageError(content: string) {
  if (!content.trim()) return "Hãy nhập yêu cầu của bạn.";
  if (content.length > agentMessageLimit) return "Tin nhắn tối đa 4.000 ký tự.";
  return null;
}
export function canConfirmProposal(
  conversation: AgentConversation,
  now: number,
) {
  const proposal = conversation.currentProposal;
  return (
    conversation.status === "active" &&
    !conversation.processing &&
    !!proposal &&
    proposal.status === "ready" &&
    proposal.validation.errors.length === 0 &&
    !proposal.snapshot.state.pendingQuestion &&
    !conversation.state.pendingQuestion &&
    Date.parse(proposal.expiresAt) > now
  );
}
export function agentError(error: unknown) {
  if (!(error instanceof ApiError)) return getErrorMessage(error);
  const messages: Record<string, string> = {
    CONVERSATION_NOT_FOUND: "Không tìm thấy hội thoại. Hãy mở hội thoại mới.",
    CONVERSATION_EXPIRED:
      "Hội thoại đã hết hạn. Bạn có thể mở hội thoại mới; lộ trình đã lưu vẫn được giữ.",
    MESSAGE_ID_REUSED:
      "Mã tin nhắn đã được dùng. Hãy tải lại hội thoại trước khi gửi tiếp.",
    CONVERSATION_BUSY:
      "Trợ lý đang xử lý một yêu cầu khác. Đang kiểm tra hội thoại…",
    CONVERSATION_VERSION_CONFLICT:
      "Hội thoại đã thay đổi. Hãy xem nội dung mới trước khi gửi tiếp.",
    ROADMAP_VERSION_CONFLICT:
      "Lộ trình đã được thay đổi ở nơi khác. Hãy yêu cầu bản xem trước mới; ANGI chưa ghi đè dữ liệu.",
    PROPOSAL_VERSION_CONFLICT:
      "Bản xem trước đã thay đổi. Hãy kiểm tra bản mới trước khi xác nhận.",
    PROPOSAL_NOT_COMMITTABLE:
      "Bản xem trước không còn đủ điều kiện lưu. Hãy xem lỗi bên dưới và yêu cầu phương án mới.",
    PROPOSAL_EXPIRED:
      "Bản xem trước đã hết hạn. Hãy yêu cầu một phương án mới.",
    AGENT_UNAVAILABLE:
      "Trợ lý chưa xử lý được yêu cầu. Bạn có thể thử lại; bản nháp trước đó được giữ.",
    HTTP_404: "Backend hiện chưa cung cấp API Trợ lý món ăn.",
    ROUTE_NOT_FOUND: "Backend hiện chưa cung cấp API Trợ lý món ăn.",
  };
  if (error.errorCode === "AGENT_RATE_LIMITED")
    return error.retryAfter
      ? `Đã đạt giới hạn tin nhắn. Vui lòng thử lại sau ${error.retryAfter} giây.`
      : "Đã đạt giới hạn tin nhắn. Vui lòng thử lại sau.";
  return messages[error.errorCode] ?? getErrorMessage(error);
}
export function validationFromError(error: unknown): AgentValidation | null {
  const data: unknown = error instanceof ApiError ? error.data : null;
  if (
    !data ||
    typeof data !== "object" ||
    !("errors" in data) ||
    !("warnings" in data) ||
    !("totalCost" in data) ||
    !("routes" in data)
  )
    return null;
  if (
    !Array.isArray(data.errors) ||
    !data.errors.every((entry: unknown) => typeof entry === "string") ||
    !Array.isArray(data.warnings) ||
    !data.warnings.every((entry: unknown) => typeof entry === "string") ||
    typeof data.totalCost !== "number"
  )
    return null;
  // Only the error and warning text is needed from an error payload, never trust route objects here.
  return {
    errors: data.errors,
    warnings: data.warnings,
    totalCost: data.totalCost,
    routes: [],
  };
}
export function proposalItems(proposal: AgentProposal) {
  const order = ["breakfast", "lunch", "dinner", "snack", "late_night"];
  return [...proposal.snapshot.items].sort(
    (a, b) =>
      a.dayNumber - b.dayNumber ||
      order.indexOf(a.mealSlot) - order.indexOf(b.mealSlot) ||
      a.sortOrder - b.sortOrder,
  );
}
export function newAgentMessageId() {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return (values[0] & 0x1fffff) * 4294967296 + values[1] || 1;
}
export const agentStorageKey = (userId: number, roadmapId: number) =>
  `angi-agent:${userId}:${roadmapId}`;
export function storedConversation(key: string): number | null {
  try {
    const id = Number(sessionStorage.getItem(key));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
export function rememberConversation(key: string, id: number | null) {
  try {
    if (id === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(id));
  } catch {
    /* Storage is optional; the current in-memory conversation still works. */
  }
}
