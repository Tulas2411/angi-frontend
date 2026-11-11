/**
 * MOD-RP1..MOD-RP4 wire contracts, API Design v1.8.
 *
 * Only the fields the moderator screens read are modelled; `target` of a report
 * detail is polymorphic (RestaurantCard or BlogDetail), so it stays `unknown`.
 */

export type ReportTargetType = "restaurant" | "blog";

export type ReportStatus = "pending" | "in_review" | "resolved" | "dismissed";

export type ReportReasonCode =
  | "wrong_info"
  | "closed"
  | "spam"
  | "offensive"
  | "hygiene"
  | "scam"
  | "other";

/** The action a conclusion applies to its target, exactly as the backend spells it. */
export type ResolutionAction =
  | "none"
  | "hide_blog"
  | "remove_blog"
  | "warn_user"
  | "suspend_user"
  | "ban_user"
  | "hide_restaurant"
  | "suspend_restaurant";

export interface ReportUserDto {
  id: number;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReportDto {
  id: number;
  targetType: ReportTargetType;
  targetId: number;
  targetName: string;
  reasonCode: ReportReasonCode;
  description: string | null;
  evidenceUrls: string[];
  reporter: ReportUserDto;
  status: ReportStatus;
  handledBy: ReportUserDto | null;
  handledAt: string | null;
  resolutionAction: ResolutionAction | null;
  resolutionNote: string | null;
  reportCountOnTarget: number;
  createdAt: string;
}

export interface ReportDetailDto extends ReportDto {
  /** RestaurantCard for a restaurant report, BlogDetail for a blog report. */
  target: unknown;
  relatedReports: ReportDto[];
}

export interface ReportsPageDto {
  items: ReportDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** MOD-RP1 filters. `targetType` is required by the backend. */
export interface ListReportsQuery {
  targetType: ReportTargetType;
  status?: ReportStatus;
  reasonCode?: ReportReasonCode;
  targetId?: number;
  page?: number;
  pageSize?: number;
}

/** MOD-RP4 body. */
export interface ResolveReportRequestDto {
  outcome: "resolved" | "dismissed";
  resolutionAction: ResolutionAction;
  resolutionNote?: string;
  /** Required when `resolutionAction` is `suspend_user`. */
  suspendUntil?: string;
  applyToRelatedReports?: boolean;
}

/** The conclusion form of the moderator screen. */
export interface ReportConclusion {
  outcome: "resolved" | "dismissed";
  action: ResolutionAction;
  note: string;
  applyToRelatedReports: boolean;
}
