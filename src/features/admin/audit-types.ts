/**
 * Wire DTOs of F-64 View System Audit Logs (API Design v1.8: ADM-A1, ADM-A2, sheet DTO "AuditLog";
 * BE `AdminAuditLogsController`, `AuditLogDto`, `AuditLogDetailDto`).
 */

/** The four roles an audit row can record for its actor (`audit_logs.actor_role`). */
export type AuditActorRole = "TRAVELER" | "RESTAURANT_OWNER" | "MOD" | "ADMIN";

/** Who did it, with the role captured when the row was written. */
export interface AuditActorDto {
  id: number;
  displayName: string;
  role: AuditActorRole | null;
}

/** The user the action was about. */
export interface AuditSubjectUserDto {
  id: number;
  displayName: string;
  avatarUrl: string | null;
}

/** ADM-A1 item: one row of `audit_logs`, newest first. */
export interface AuditLogDto {
  id: number;
  /** Null for a system action (no signed-in actor). */
  actor: AuditActorDto | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  subjectUser: AuditSubjectUserDto | null;
  createdAt: string;
}

/** ADM-A2: every field, with the changed columns before and after (snake_case keys). */
export interface AuditLogDetailDto extends AuditLogDto {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** ADM-A1 response: `Paged<AuditLog>`. */
export interface AuditLogsPageDto {
  items: AuditLogDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** ADM-A1 query: every filter is optional; `from`/`to` are ISO date-times. */
export interface AuditLogsQuery {
  actorId?: number;
  subjectUserId?: number;
  actorRole?: AuditActorRole;
  action?: string;
  entityType?: string;
  entityId?: number;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}
