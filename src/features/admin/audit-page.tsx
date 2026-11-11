"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  FunnelIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card, Input } from "@/shared/ui";
import {
  Dialog,
  EmptyState,
  Pagination,
  SelectField,
  Skeleton,
} from "@/components/ui/primitives";
import { DateField } from "@/components/ui/date-time-fields";
import { PageHeading } from "@/components/layout/workspace";
import { useRemote } from "@/features/explore/use-remote";
import {
  activeAuditFilters,
  auditActionLabel,
  auditActionOptions,
  auditActionTone,
  auditAgent,
  auditChanges,
  auditDateTime,
  auditDay,
  auditEntityLabel,
  auditEntityTypes,
  auditError,
  auditFilterProblems,
  auditPageSize,
  auditQuery,
  auditReason,
  auditRoles,
  auditTime,
  auditValueText,
  emptyAuditFilters,
  type AuditChange,
  type AuditFilters,
} from "./audit-rules";
import { auditService, type AuditService } from "./audit-service";
import type {
  AuditActorRole,
  AuditLogDetailDto,
  AuditLogDto,
} from "./audit-types";
import "@/features/moderation/moderation-drawer.css";
import "./audit.css";

const roleFilters: { value: "" | AuditActorRole; label: string }[] = [
  { value: "", label: "Mọi vai trò" },
  { value: "ADMIN", label: "Admin" },
  { value: "MOD", label: "Mod" },
  { value: "RESTAURANT_OWNER", label: "Chủ quán" },
  { value: "TRAVELER", label: "Người dùng" },
];

const entityOptions = [
  { value: "", label: "Mọi đối tượng" },
  ...Object.entries(auditEntityTypes).map(([value, label]) => ({
    value,
    label,
  })),
];

/**
 * F-64 View System Audit Logs: ADM-A1 lists `audit_logs` newest first with every documented
 * filter; a row opens ADM-A2 in a side drawer with the values before and after. Read only — the
 * table is append-only in the database.
 */
export function AuditLogPage({
  service = auditService,
}: {
  service?: AuditService;
}) {
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters);
  // The id boxes are typed: they reach the query a moment after the last key press.
  const [typed, setTyped] = useState({
    actorId: "",
    subjectUserId: "",
    entityId: "",
  });
  const [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.actorId === typed.actorId &&
        current.subjectUserId === typed.subjectUserId &&
        current.entityId === typed.entityId
          ? current
          : { ...current, ...typed },
      );
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [typed]);

  const problems = auditFilterProblems(filters);
  const blocked = Object.keys(problems).length > 0;
  const query = auditQuery(filters, page);
  const [list, retry] = useRemote(
    () => (blocked ? Promise.resolve(null) : service.list(query)),
    `${JSON.stringify(query)}:${blocked}:${version}`,
  );

  function change(patch: Partial<AuditFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }
  function reset() {
    setFilters(emptyAuditFilters);
    setTyped({ actorId: "", subjectUserId: "", entityId: "" });
    setPage(1);
  }
  /** From the drawer: show every row of an actor, a subject or an entity. */
  function focusOn(patch: Partial<AuditFilters>) {
    const next = { ...emptyAuditFilters, ...patch };
    setFilters(next);
    setTyped({
      actorId: next.actorId,
      subjectUserId: next.subjectUserId,
      entityId: next.entityId,
    });
    if (next.actorId || next.subjectUserId || next.entityId) setAdvanced(true);
    setPage(1);
    setOpenId(null);
  }

  const active = activeAuditFilters(filters);
  const idFilters = [
    filters.actorId,
    filters.subjectUserId,
    filters.entityId,
  ].filter((value) => value.trim()).length;

  return (
    <div className="stack audit-page">
      <PageHeading
        title="Nhật ký hệ thống"
        description="Mọi thao tác quan trọng trên ANGI: ai làm, làm gì, với đối tượng nào và giá trị trước, sau. Nhật ký chỉ đọc, không thể sửa hay xóa."
        action={
          <Button
            variant="secondary"
            className="audit-refresh"
            onClick={() => setVersion((value) => value + 1)}
          >
            <ArrowPathIcon aria-hidden /> Tải lại
          </Button>
        }
      />

      <section className="card audit-filters" aria-label="Bộ lọc nhật ký">
        <div className="audit-filter-top">
          <div
            className="audit-roles"
            role="group"
            aria-label="Lọc theo vai trò người thực hiện"
          >
            {roleFilters.map((role) => (
              <button
                key={role.value}
                type="button"
                aria-pressed={filters.actorRole === role.value}
                onClick={() => change({ actorRole: role.value })}
              >
                {role.label}
              </button>
            ))}
          </div>
          <div className="audit-filter-tools">
            <button
              type="button"
              className="audit-advanced-toggle"
              aria-expanded={advanced}
              aria-controls="audit-advanced"
              onClick={() => setAdvanced((value) => !value)}
            >
              <AdjustmentsHorizontalIcon aria-hidden /> Lọc theo mã
              {idFilters > 0 && (
                <span className="audit-count">{idFilters}</span>
              )}
            </button>
            {active > 0 && (
              <button type="button" className="audit-reset" onClick={reset}>
                <XMarkIcon aria-hidden /> Xóa bộ lọc ({active})
              </button>
            )}
          </div>
        </div>
        <div className="audit-filter-grid">
          <SelectField
            label="Hành động"
            value={filters.action}
            onChange={(value) => change({ action: value })}
            options={auditActionOptions()}
          />
          <SelectField
            label="Loại đối tượng"
            value={filters.entityType}
            onChange={(value) => change({ entityType: value })}
            options={entityOptions}
          />
          <DateField
            label="Từ ngày"
            placeholder="Chọn ngày bắt đầu"
            value={filters.fromDate}
            max={filters.toDate || undefined}
            onChange={(value) => change({ fromDate: value })}
          />
          <DateField
            label="Đến ngày"
            placeholder="Chọn ngày kết thúc"
            value={filters.toDate}
            min={filters.fromDate || undefined}
            error={problems.toDate}
            onChange={(value) => change({ toDate: value })}
          />
        </div>
        {advanced && (
          <div className="audit-filter-grid audit-advanced" id="audit-advanced">
            <IdField
              label="Mã người thực hiện"
              placeholder="Ví dụ: 37"
              value={typed.actorId}
              error={problems.actorId}
              onChange={(value) =>
                setTyped((current) => ({ ...current, actorId: value }))
              }
            />
            <IdField
              label="Mã người bị tác động"
              placeholder="Ví dụ: 12"
              value={typed.subjectUserId}
              error={problems.subjectUserId}
              onChange={(value) =>
                setTyped((current) => ({ ...current, subjectUserId: value }))
              }
            />
            <IdField
              label="Mã đối tượng"
              placeholder="Ví dụ: 29"
              helper="Dùng cùng loại đối tượng để lọc đúng một đối tượng."
              value={typed.entityId}
              error={problems.entityId}
              onChange={(value) =>
                setTyped((current) => ({ ...current, entityId: value }))
              }
            />
          </div>
        )}
      </section>

      {blocked ? (
        <Alert tone="warning">Sửa bộ lọc đang báo lỗi để xem nhật ký.</Alert>
      ) : list.status === "loading" ? (
        <Skeleton rows={6} />
      ) : list.status === "error" ? (
        <Card title="Chưa tải được nhật ký hệ thống">
          <Alert>{auditError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState
          title={
            active ? "Không có bản ghi khớp bộ lọc" : "Chưa có bản ghi nào"
          }
          action={
            active ? (
              <Button variant="secondary" onClick={reset}>
                Xóa bộ lọc
              </Button>
            ) : undefined
          }
        >
          {active
            ? "Thử nới khoảng ngày hoặc bỏ bớt điều kiện lọc."
            : "Các thao tác quan trọng sẽ được ghi lại tại đây."}
        </EmptyState>
      ) : (
        <AuditList
          items={list.data.items}
          total={list.data.totalItems}
          openId={openId}
          onOpen={setOpenId}
        />
      )}

      {list.status === "ready" &&
        list.data &&
        list.data.totalItems > auditPageSize && (
          <Pagination
            total={list.data.totalItems}
            page={page}
            size={auditPageSize}
            onChange={setPage}
          />
        )}

      <Dialog
        drawer
        className="mod-drawer audit-drawer"
        open={openId !== null}
        title={openId !== null ? `Bản ghi #${openId}` : "Bản ghi nhật ký"}
        onClose={() => setOpenId(null)}
      >
        {openId !== null && (
          <AuditDetail
            key={openId}
            id={openId}
            service={service}
            onFocus={focusOn}
          />
        )}
      </Dialog>
    </div>
  );
}

function IdField({
  label,
  placeholder,
  helper,
  value,
  error,
  onChange,
}: {
  label: string;
  placeholder: string;
  helper?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field audit-id-field">
      <span>{label}</span>
      <Input
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-invalid={!!error}
        onChange={(event) => onChange(event.target.value.replace(/\s/g, ""))}
      />
      {(error || helper) && (
        <small className={error ? "field-error" : "helper"}>
          {error || helper}
        </small>
      )}
    </label>
  );
}

/** The page's rows grouped by the day they happened; each row opens its detail. */
function AuditList({
  items,
  total,
  openId,
  onOpen,
}: {
  items: AuditLogDto[];
  total: number;
  openId: number | null;
  onOpen: (id: number) => void;
}) {
  const groups: { key: string; label: string; items: AuditLogDto[] }[] = [];
  for (const item of items) {
    const day = auditDay(item.createdAt);
    const group = groups.find((entry) => entry.key === day.key);
    if (group) group.items.push(item);
    else groups.push({ ...day, items: [item] });
  }
  return (
    <section className="audit-results" aria-label="Kết quả nhật ký">
      <p className="helper audit-total" role="status">
        <FunnelIcon aria-hidden /> {total.toLocaleString("vi-VN")} bản ghi · mới
        nhất trước
      </p>
      {groups.map((group) => (
        <section key={group.key} className="audit-day">
          <h2 className="audit-day-title">
            {group.label}
            <span>{group.items.length}</span>
          </h2>
          <ol className="audit-list">
            {group.items.map((item) => {
              const entity = auditEntityLabel(item.entityType, item.entityId);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="audit-row"
                    data-tone={auditActionTone(item.action)}
                    aria-current={openId === item.id || undefined}
                    aria-label={`Xem bản ghi #${item.id}: ${auditActionLabel(item.action)}`}
                    onClick={() => onOpen(item.id)}
                  >
                    <time className="audit-row-time" dateTime={item.createdAt}>
                      {auditTime(item.createdAt)}
                    </time>
                    <span className="audit-row-action">
                      <span className="audit-dot" aria-hidden />
                      <strong>{auditActionLabel(item.action)}</strong>
                    </span>
                    <span className="audit-row-actor">
                      {item.actor ? (
                        <>
                          <span>
                            {item.actor.displayName || `#${item.actor.id}`}
                          </span>
                          {item.actor.role && (
                            <small data-role={item.actor.role}>
                              {auditRoles[item.actor.role] ?? item.actor.role}
                            </small>
                          )}
                        </>
                      ) : (
                        <span className="audit-muted">Hệ thống</span>
                      )}
                    </span>
                    <span className="audit-row-target">
                      {entity ?? <span className="audit-muted">—</span>}
                      {item.subjectUser &&
                        item.subjectUser.id !== item.actor?.id && (
                          <small>→ {item.subjectUser.displayName}</small>
                        )}
                    </span>
                    <ChevronRightIcon className="audit-row-go" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </section>
  );
}

/** ADM-A2 in the drawer: who, what, on which entity, from where, and the values that changed. */
function AuditDetail({
  id,
  service,
  onFocus,
}: {
  id: number;
  service: AuditService;
  onFocus: (patch: Partial<AuditFilters>) => void;
}) {
  const [state, retry] = useRemote(() => service.detail(id), String(id));
  if (state.status === "loading") return <Skeleton rows={6} />;
  if (state.status === "error")
    return (
      <div className="stack-sm">
        <Alert>{auditError(state.error)}</Alert>
        <Button variant="secondary" onClick={retry}>
          Thử lại
        </Button>
      </div>
    );
  const detail: AuditLogDetailDto = state.data;
  const changes = auditChanges(detail);
  const reason = auditReason(detail);
  const entity = auditEntityLabel(detail.entityType, detail.entityId);
  const tone = auditActionTone(detail.action);
  return (
    <div className="audit-detail">
      <header className="audit-detail-head" data-tone={tone}>
        <Badge tone={tone}>{auditActionLabel(detail.action)}</Badge>
        <code>{detail.action}</code>
        <p>{auditDateTime(detail.createdAt)}</p>
      </header>

      <dl className="audit-facts">
        <Fact label="Người thực hiện">
          {detail.actor ? (
            <>
              <strong>{detail.actor.displayName || "Không rõ tên"}</strong>
              <span>
                {detail.actor.role
                  ? (auditRoles[detail.actor.role] ?? detail.actor.role)
                  : "Không rõ vai trò"}{" "}
                · #{detail.actor.id}
              </span>
              <button
                type="button"
                className="audit-link"
                onClick={() => onFocus({ actorId: String(detail.actor!.id) })}
              >
                Xem mọi thao tác của người này
              </button>
            </>
          ) : (
            <strong>Hệ thống</strong>
          )}
        </Fact>
        <Fact label="Người bị tác động">
          {detail.subjectUser ? (
            <>
              <strong>{detail.subjectUser.displayName}</strong>
              <span>#{detail.subjectUser.id}</span>
              <button
                type="button"
                className="audit-link"
                onClick={() =>
                  onFocus({ subjectUserId: String(detail.subjectUser!.id) })
                }
              >
                Xem lịch sử liên quan
              </button>
            </>
          ) : (
            <span className="audit-muted">Không có</span>
          )}
        </Fact>
        <Fact label="Đối tượng">
          {entity ? (
            <>
              <strong>{entity}</strong>
              {detail.entityType && detail.entityId !== null && (
                <button
                  type="button"
                  className="audit-link"
                  onClick={() =>
                    onFocus({
                      entityType: detail.entityType!,
                      entityId: String(detail.entityId),
                    })
                  }
                >
                  Xem mọi thao tác trên đối tượng này
                </button>
              )}
            </>
          ) : (
            <span className="audit-muted">Không có</span>
          )}
        </Fact>
        <Fact label="Nguồn">
          <span className="audit-source">
            <GlobeAltIcon aria-hidden /> {detail.ipAddress ?? "Không ghi nhận"}
          </span>
          <span className="audit-source" title={detail.userAgent ?? undefined}>
            <ComputerDesktopIcon aria-hidden /> {auditAgent(detail.userAgent)}
          </span>
        </Fact>
      </dl>

      {reason && (
        <section className="audit-reason">
          <h3>Lý do</h3>
          <p>{reason}</p>
        </section>
      )}

      <section className="audit-changes">
        <h3>Thay đổi</h3>
        {changes.length === 0 ? (
          <p className="audit-muted">
            Thao tác này không ghi giá trị trước và sau.
          </p>
        ) : (
          <ul>
            {changes.map((change) => (
              <ChangeRow key={change.key} change={change} />
            ))}
          </ul>
        )}
      </section>

      {(detail.oldValues || detail.newValues) && (
        <details className="audit-raw">
          <summary>
            <ShieldCheckIcon aria-hidden /> Dữ liệu gốc (JSON)
          </summary>
          <div className="audit-raw-grid">
            <div>
              <span>Trước</span>
              <pre>{JSON.stringify(detail.oldValues, null, 2) ?? "null"}</pre>
            </div>
            <div>
              <span>Sau</span>
              <pre>{JSON.stringify(detail.newValues, null, 2) ?? "null"}</pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="audit-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** One changed column; a list shows what was added and removed instead of two long lines. */
function ChangeRow({ change }: { change: AuditChange }) {
  const isList = change.added !== undefined;
  return (
    <li className="audit-change">
      <span className="audit-change-key">
        {change.label}
        <code>{change.key}</code>
      </span>
      {isList ? (
        <div className="audit-change-list">
          {change.added!.map((item) => (
            <span key={`+${item}`} className="audit-chip" data-kind="added">
              + {auditValueText(item)}
            </span>
          ))}
          {change.removed!.map((item) => (
            <span key={`-${item}`} className="audit-chip" data-kind="removed">
              − {auditValueText(item)}
            </span>
          ))}
          {change.added!.length === 0 && change.removed!.length === 0 && (
            <span className="audit-muted">Không đổi</span>
          )}
        </div>
      ) : (
        <div className="audit-change-values">
          <span
            className="audit-before"
            data-empty={change.before === undefined || undefined}
          >
            {change.before === undefined ? "—" : auditValueText(change.before)}
          </span>
          <span className="audit-arrow" aria-label="thành">
            →
          </span>
          <span
            className="audit-after"
            data-empty={change.after === undefined || undefined}
          >
            {change.after === undefined ? "—" : auditValueText(change.after)}
          </span>
        </div>
      )}
    </li>
  );
}
