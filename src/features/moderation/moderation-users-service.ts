import { api } from "@/shared/api/client";
import type {
  CreateSanctionRequestDto,
  ListModeratedUsersQuery,
  ModeratedUserDetailDto,
  ModeratedUsersPageDto,
  SanctionDto,
  UnbanUserRequestDto,
} from "./moderation-users-types";

/**
 * MOD-U1..MOD-U4 — user moderation.
 *
 * The endpoints live behind the same-origin proxy (`/api/backend/mod/users`),
 * so the moderator's access token never reaches the browser.
 */
export interface ModerationUsersService {
  /** MOD-U1: one page of the accounts a moderator may look up. */
  list(query: ListModeratedUsersQuery): Promise<ModeratedUsersPageDto>;
  /** MOD-U2: profile, sanction history and content counters of one account. */
  detail(userId: number): Promise<ModeratedUserDetailDto>;
  /** MOD-U3: warns, suspends or bans an account. */
  sanction(
    userId: number,
    request: CreateSanctionRequestDto,
  ): Promise<SanctionDto>;
  /** MOD-U4: lifts an active ban or suspension. */
  unban(userId: number, request: UnbanUserRequestDto): Promise<unknown>;
}

const base = "mod/users";

export const moderationUsersService: ModerationUsersService = {
  list: (query) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.role) params.set("role", query.role);
    if (query.status) params.set("status", query.status);
    if (query.hasPendingReports !== undefined)
      params.set("hasPendingReports", String(query.hasPendingReports));
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.pageSize !== undefined)
      params.set("pageSize", String(query.pageSize));
    const search = params.toString();
    return api.get<ModeratedUsersPageDto>(`${base}${search ? `?${search}` : ""}`);
  },
  detail: (userId) => api.get<ModeratedUserDetailDto>(`${base}/${userId}`),
  sanction: (userId, request) =>
    api.post<SanctionDto>(`${base}/${userId}/sanctions`, request),
  unban: (userId, request) => api.post(`${base}/${userId}/unban`, request),
};

/** Nhãn tiếng Việt của trạng thái tài khoản. */
export const userStatusLabels: Record<string, string> = {
  pending_verification: "Chờ xác minh",
  active: "Đang hoạt động",
  suspended: "Tạm đình chỉ",
  banned: "Bị cấm",
  deactivated: "Đã ngừng hoạt động",
};

/** Nhãn tiếng Việt của hình thức xử phạt. */
export const sanctionTypeLabels: Record<string, string> = {
  warn: "Cảnh báo",
  suspend: "Tạm đình chỉ",
  ban: "Cấm tài khoản",
};

/** Tài khoản đã bị cấm thì không xử phạt thêm được (BE trả 409 USER_ALREADY_BANNED). */
export function canSanction(status: string): boolean {
  return status !== "banned";
}

/** Tài khoản đang bị hạn chế thì mới có thể gỡ hạn chế. */
export function canLiftRestriction(status: string): boolean {
  return status === "suspended" || status === "banned";
}
