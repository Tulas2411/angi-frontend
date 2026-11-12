import { ApiError, getErrorMessage } from "@/shared/api/error";
import { vnd } from "./roadmap-list-rules";
import type {
  AgentStarterCommand,
  AgentConversation,
  AgentItem,
  AgentProposal,
  AgentState,
  AgentValidation,
} from "./agent-types";

export const agentMessageLimit = 4000;
export const agentPollMs = 2000;
export const agentPollLimitMs = 90000;
/** Same as the backend's default radius around the traveler. */
const agentNearbyKm = 10;

/** A starter button: the label shown and sent as the message, and the command that tells the backend exactly what it means. */
export interface AgentPromptSuggestion {
  label: string;
  command: AgentStarterCommand;
}

/**
 * Suggestions use only what the conversation already knows, never an invented place or price. Each one is a button, not typed
 * text: its command makes the backend run the matching search itself (whole trip, lunch within budget, regional dishes), so the
 * model never has to guess what the label meant.
 */
export function agentPromptSuggestions(
  state: AgentState | null | undefined,
): AgentPromptSuggestion[] {
  const place = state?.province ? ` ở ${state.province}` : "";
  return [
    {
      label: state?.numDays
        ? `Lộ trình ăn uống ${state.numDays} ngày${place}`
        : `Lập lịch ăn uống${place}`,
      command: "plan_trip",
    },
    {
      label: state?.maxPricePerMeal
        ? `Bữa trưa dưới ${vnd(state.maxPricePerMeal)}${place}`
        : `Bữa trưa hợp ngân sách${place}`,
      command: "suggest_lunch",
    },
    { label: `Món đặc trưng nên thử${place}`, command: "suggest_specialty" },
  ];
}

export type AgentPanelMode = "popup" | "expanded";

/**
 * How much of a finished reply to show after the next step of its word-by-word reveal. It always
 * ends on a whole word, and a reply of any length is done in about 50 steps.
 */
export function agentRevealNext(text: string, shown: number) {
  const step = Math.max(4, Math.ceil(text.length / 50));
  const space = text.indexOf(" ", shown + step);
  return space === -1 ? text.length : space;
}

export type AgentInline =
  | { kind: "text" | "strong"; text: string }
  | { kind: "item"; text: string; itemKey: string };
export type AgentReplyBlock =
  | { kind: "paragraph"; lines: AgentInline[][] }
  | { kind: "bullets" | "numbers"; items: AgentInline[][] };

function agentInlines(text: string, links: ReadonlyMap<string, string>) {
  const names = [...links.keys()]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const linked = names.length ? new RegExp(`(${names.join("|")})`) : null;
  return text.split(/\*\*(.+?)\*\*/).flatMap((part, index): AgentInline[] => {
    const plain = index % 2 === 0 ? "text" : "strong";
    return (linked ? part.split(linked) : [part]).flatMap(
      (piece, position): AgentInline[] => {
        if (!piece) return [];
        const itemKey = position % 2 === 1 ? links.get(piece) : undefined;
        return itemKey
          ? [{ kind: "item", text: piece, itemKey }]
          : [{ kind: plain, text: piece }];
      },
    );
  });
}

/**
 * Reads a reply's paragraphs, lists and bold text into data rendered as React nodes, so reply
 * text is never treated as HTML. Dish and restaurant names of `items` become links to their pin.
 */
export function agentReplyBlocks(
  text: string,
  items: readonly AgentItem[] = [],
): AgentReplyBlock[] {
  const links = new Map<string, string>();
  for (const item of items)
    for (const name of [item.dishName, item.restaurantName])
      if (name && !links.has(name)) links.set(name, item.itemKey);
  const blocks: AgentReplyBlock[] = [];
  let open = null as AgentReplyBlock | null;
  for (const line of text.split(/\r?\n/)) {
    const bullet = /^\s*[-•*]\s+(.+)$/.exec(line);
    const number = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    const kind = bullet ? "bullets" : number ? "numbers" : "paragraph";
    if (!line.trim()) {
      open = null;
      continue;
    }
    const parts = agentInlines((bullet ?? number)?.[1] ?? line.trim(), links);
    if (open?.kind !== kind) {
      open =
        kind === "paragraph"
          ? { kind, lines: [] }
          : { kind: kind as "bullets" | "numbers", items: [] };
      blocks.push(open);
    }
    if (open.kind === "paragraph") open.lines.push(parts);
    else open.items.push(parts);
  }
  return blocks;
}

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
    MESSAGE_ID_REUSED: "Tin nhắn này chưa gửi được. Bạn gửi lại giúp mình nhé.",
    CONVERSATION_BUSY:
      "Mình đang xử lý một yêu cầu khác. Bạn đợi một chút rồi gửi lại nhé.",
    CONVERSATION_VERSION_CONFLICT:
      "Hội thoại vừa được cập nhật. Bạn xem nội dung mới rồi gửi lại nhé.",
    ROADMAP_VERSION_CONFLICT:
      "Lộ trình đã được thay đổi ở nơi khác. Hãy yêu cầu bản nháp mới; ANGI chưa ghi đè dữ liệu.",
    PROPOSAL_VERSION_CONFLICT:
      "Bản nháp đã thay đổi. Hãy kiểm tra bản mới trước khi xác nhận.",
    PROPOSAL_NOT_COMMITTABLE:
      "Bản nháp không còn đủ điều kiện lưu. Hãy xem lỗi bên dưới và yêu cầu phương án mới.",
    PROPOSAL_EXPIRED: "Bản nháp đã hết hạn. Hãy yêu cầu một phương án mới.",
    HTTP_404: "Backend hiện chưa cung cấp API Trợ lý món ăn.",
    ROUTE_NOT_FOUND: "Backend hiện chưa cung cấp API Trợ lý món ăn.",
  };
  if (error.errorCode === "AGENT_RATE_LIMITED")
    return error.retryAfter
      ? `Đã đạt giới hạn tin nhắn. Vui lòng thử lại sau ${error.retryAfter} giây.`
      : "Đã đạt giới hạn tin nhắn. Vui lòng thử lại sau.";
  return messages[error.errorCode] ?? getErrorMessage(error);
}
/** True when the backend answered and the turn is over, so sending again is a new message; anything else may still have been processed. */
export function agentTurnSettled(error: unknown) {
  return (
    error instanceof ApiError &&
    ([400, 404, 409, 410, 429].includes(error.status) ||
      error.errorCode === "AGENT_UNAVAILABLE")
  );
}
const currentLocationWords =
  /\b(?:vi tri (?:hien tai|cua toi|cua minh)|gan day|quanh day|gan toi|gan minh|quanh toi|quanh minh|gan cho (?:toi|minh)|cho (?:toi|minh) dang o|noi (?:toi|minh) dang o)\b/;
/** Reads "vị trí hiện tại" in typed text, with or without accents, so it works like the button. */
export function mentionsCurrentLocation(text: string) {
  const plain = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
  return currentLocationWords.test(plain);
}
/** Says why the browser gave no position, using its GeolocationPositionError code; null means it never asked. */
export function agentLocationProblem(code: number | null, secure: boolean) {
  const fallback = "Bạn nhắn tên tỉnh/thành phố giúp mình nhé.";
  if (!secure)
    return `Trình duyệt chỉ cho lấy vị trí trên trang HTTPS hoặc localhost. ${fallback}`;
  if (code === 1)
    return "Trình duyệt đang chặn quyền vị trí của trang này. Bạn cho phép ở biểu tượng cạnh thanh địa chỉ rồi thử lại, hoặc nhắn tên tỉnh/thành phố nhé.";
  if (code === 2)
    return `Máy chưa xác định được vị trí, thường do dịch vụ vị trí của hệ điều hành đang tắt. ${fallback}`;
  if (code === 3) return `Lấy vị trí lâu quá nên mình dừng lại. ${fallback}`;
  return `Trình duyệt này không hỗ trợ lấy vị trí. ${fallback}`;
}
/** One-tap answers to the backend's question; the backend stage decides, never the wording of the question. */
export function agentQuickReply(
  conversation: AgentConversation | null,
): "current-location" | "plan-now" | null {
  if (
    !conversation ||
    conversation.status !== "active" ||
    conversation.currentProposal
  )
    return null;
  if (conversation.state.planningIntake === "preferences") return "plan-now";
  return conversation.state.planningIntake === "details" &&
    !conversation.state.province
    ? "current-location"
    : null;
}
/** Sends coordinates only as this turn's confirmed state; they are never kept in browser storage. */
export function agentLocationState(
  state: AgentState,
  latitude: number,
  longitude: number,
): AgentState {
  return {
    ...state,
    originMode: "gps",
    originLatitude: Number(latitude.toFixed(6)),
    originLongitude: Number(longitude.toFixed(6)),
    originLabel: "Vị trí hiện tại",
    // With a place still to find, the backend picks the nearest one and sets the radius itself.
    radiusKm: state.province ? agentNearbyKm : null,
  };
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
/** Keeps only the notices the proposal card does not already show, so nothing appears twice. */
export function standaloneValidation(
  validation: AgentValidation | null,
  proposal: AgentProposal | null | undefined,
): AgentValidation | null {
  if (!validation || !proposal) return validation;
  const errors = validation.errors.filter(
    (text) => !proposal.validation.errors.includes(text),
  );
  const warnings = validation.warnings.filter(
    (text) => !proposal.validation.warnings.includes(text),
  );
  return errors.length || warnings.length
    ? { ...validation, errors, warnings }
    : null;
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
