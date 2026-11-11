import { api } from "@/shared/api/client";
import { auditQueryString } from "./audit-rules";
import type {
  AuditLogDetailDto,
  AuditLogsPageDto,
  AuditLogsQuery,
} from "./audit-types";

/** F-64 View System Audit Logs through the same-origin proxy (Admin sessions only). */
export interface AuditService {
  /** ADM-A1: one filtered page of the system audit log, newest first. */
  list(query: AuditLogsQuery): Promise<AuditLogsPageDto>;
  /** ADM-A2: one row with the values before and after, IP and user agent. */
  detail(auditLogId: number): Promise<AuditLogDetailDto>;
}

export const auditService: AuditService = {
  list: (query) =>
    api.get<AuditLogsPageDto>(`admin/audit-logs${auditQueryString(query)}`),
  detail: (auditLogId) =>
    api.get<AuditLogDetailDto>(`admin/audit-logs/${auditLogId}`),
};
