"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Pagination,
  SelectField,
  Skeleton,
  Tabs,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { getErrorMessage } from "@/shared/api/error";
import {
  canDismissReport,
  conclusionActions,
  moderationReportsService,
  reportStatusTone,
  type ModerationReportsService,
} from "./moderation-service";
import type {
  ReportDetailDto,
  ReportDto,
  ReportStatus,
  ReportTargetType,
  ResolutionAction,
} from "./moderation-types";

const PAGE_SIZE = 20;

/** Nhãn tiếng Việt của trạng thái báo cáo. */
const statusLabels: Record<ReportStatus, string> = {
  pending: "Chưa nhận",
  in_review: "Đang xử lý",
  resolved: "Đã giải quyết",
  dismissed: "Đã bác bỏ",
};

/** Nhãn tiếng Việt của lý do báo cáo. */
const reasonLabels: Record<string, string> = {
  wrong_info: "Sai thông tin",
  closed: "Đã đóng cửa",
  spam: "Spam",
  offensive: "Xúc phạm",
  hygiene: "Vệ sinh",
  scam: "Lừa đảo",
  other: "Khác",
};

type FilterStatus = "all" | ReportStatus;

function reportHref(base: string, id: number | string) {
  return `${base}/reports/${id}`;
}

/** Danh sách báo cáo: MOD-RP1 (danh sách) + MOD-RP3 (nhận xử lý). */
export function ModerationReportsPage({ base }: { base: string }) {
  const service: ModerationReportsService = moderationReportsService;
  const [targetType, setTargetType] = useState<ReportTargetType>("restaurant");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    key: string;
    items: ReportDto[];
    totalItems: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [dismissing, setDismissing] = useState<{
    id: number;
    targetName: string;
  } | null>(null);
  /** Bộ lọc hiện tại là chìa khoá của lần tải; tải xong mới hiện dữ liệu. */
  const queryKey = `${targetType}|${status}|${page}|${reload}`;
  const loading = result?.key !== queryKey;
  const rows = result?.key === queryKey ? result.items : [];
  const totalItems = result?.key === queryKey ? result.totalItems : 0;

  useEffect(() => {
    let ignore = false;
    service
      .list({
        targetType,
        status: status === "all" ? undefined : status,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((response) => {
        if (ignore) return;
        setResult({
          key: `${targetType}|${status}|${page}|${reload}`,
          items: response.items,
          totalItems: response.totalItems,
        });
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
      });
    return () => {
      ignore = true;
    };
  }, [service, targetType, status, page, reload]);

  async function claim(reportId: number) {
    setBusyId(reportId);
    setError("");
    try {
      await service.claim(reportId);
      setReload((value) => value + 1);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  /**
   * MOD-RP4 với outcome=dismissed: bác bỏ báo cáo mà không ẩn đối tượng.
   * Hành động luôn là `none` nên đối tượng bị báo cáo không bị ảnh hưởng.
   */
  async function dismiss(reportId: number) {
    setBusyId(reportId);
    setError("");
    try {
      await service.resolve(reportId, {
        outcome: "dismissed",
        resolutionAction: "none",
        applyToRelatedReports: true,
      });
      setDismissing(null);
      setReload((value) => value + 1);
    } catch (caught) {
      setDismissing(null);
      setError(getErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <PageHeading
        title="Báo cáo vi phạm"
        description="Đọc nội dung và ngữ cảnh trước khi nhận xử lý."
      />

      {error && <Alert tone="warning">{error}</Alert>}

      <Card title="Hàng đợi báo cáo">
        <div className="owner-reviews-filters">
          <SelectField
            label="Loại đối tượng"
            value={targetType}
            onChange={(value) => {
              setTargetType(value as ReportTargetType);
              setPage(1);
            }}
            options={[
              { value: "restaurant", label: "Nhà hàng" },
              { value: "blog", label: "Bài viết" },
            ]}
          />
        </div>
        <Tabs
          value={status}
          onChange={(value) => {
            setStatus(value as FilterStatus);
            setPage(1);
          }}
          items={[
            { value: "all", label: "Tất cả" },
            { value: "pending", label: "Chưa nhận" },
            { value: "in_review", label: "Đang xử lý" },
            { value: "resolved", label: "Đã giải quyết" },
            { value: "dismissed", label: "Đã bác bỏ" },
          ]}
        />

        {loading ? (
          <Skeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="Không có báo cáo phù hợp">
            Thử đổi bộ lọc để xem thêm báo cáo.
          </EmptyState>
        ) : (
          <DataTable
            rows={rows.map((report) => ({
              ...report,
              id: String(report.id),
              reportId: report.id,
            }))}
            caption="Danh sách báo cáo"
            columns={[
              {
                label: "Đối tượng",
                render: (row) => row.targetName,
              },
              {
                label: "Lý do",
                render: (row) =>
                  reasonLabels[row.reasonCode] ?? row.reasonCode,
              },
              {
                label: "Người báo cáo",
                render: (row) => row.reporter.displayName,
              },
              {
                label: "Trạng thái",
                render: (row) => (
                  <Badge tone={reportStatusTone(row.status)}>
                    {statusLabels[row.status]}
                  </Badge>
                ),
              },
              {
                label: "Mở",
                render: (row) => (
                  <div className="actions">
                    {row.status === "pending" && (
                      <Button
                        variant="secondary"
                        loading={busyId === row.reportId}
                        onClick={() => void claim(row.reportId)}
                      >
                        Nhận xử lý
                      </Button>
                    )}
                    <ActionLink href={reportHref(base, row.reportId)} secondary>
                      Xem báo cáo →
                    </ActionLink>
                    {/* Báo cáo đã kết luận thì không còn nút bác bỏ. */}
                    {canDismissReport(row.status) && (
                      <Button
                        variant="danger"
                        loading={busyId === row.reportId}
                        onClick={() =>
                          setDismissing({
                            id: row.reportId,
                            targetName: row.targetName,
                          })
                        }
                      >
                        Bác bỏ đơn
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {totalItems > PAGE_SIZE && (
        <Pagination
          total={totalItems}
          page={page}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      <ConfirmDialog
        open={!!dismissing}
        title="Xác nhận bác bỏ báo cáo?"
        danger
        loading={busyId !== null}
        label="Bác bỏ đơn"
        onClose={() => setDismissing(null)}
        onConfirm={() => dismissing && void dismiss(dismissing.id)}
      >
        <p>
          Báo cáo về <strong>{dismissing?.targetName}</strong> sẽ được đánh dấu
          là đã bác bỏ. Đối tượng bị báo cáo không bị ẩn hay xử phạt.
        </p>
        <p>
          Các báo cáo đang mở khác về cùng đối tượng cũng sẽ được bác bỏ.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/** Chi tiết một báo cáo: MOD-RP2 (đọc) + MOD-RP3 (nhận) + MOD-RP4 (kết luận). */
export function ModerationReportDetailPage({
  base,
  reportId,
}: {
  base: string;
  reportId: number;
}) {
  const service: ModerationReportsService = moderationReportsService;
  const [result, setResult] = useState<{
    key: string;
    report: ReportDetailDto;
  } | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ResolutionAction>("none");
  const [note, setNote] = useState("");
  const [related, setRelated] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [dismissNote, setDismissNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [saved, setSaved] = useState("");
  const [reload, setReload] = useState(0);

  /** Lần tải hiện tại là chìa khoá; tải xong mới hiện chi tiết. */
  const queryKey = `${reportId}|${reload}`;
  const loading = result?.key !== queryKey;
  const report = result?.key === queryKey ? result.report : null;

  useEffect(() => {
    let ignore = false;
    service
      .detail(reportId)
      .then((response) => {
        if (ignore) return;
        setResult({ key: `${reportId}|${reload}`, report: response });
        setAction(response.resolutionAction ?? "none");
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
      });
    return () => {
      ignore = true;
    };
  }, [service, reportId, reload]);

  async function claim() {
    setBusy(true);
    setError("");
    try {
      await service.claim(reportId);
      setSaved("Đã nhận xử lý báo cáo.");
      setReload((value) => value + 1);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    setBusy(true);
    setError("");
    try {
      await service.resolve(reportId, {
        outcome: "resolved",
        resolutionAction: action,
        resolutionNote: note.trim() || undefined,
        applyToRelatedReports: related,
      });
      setConfirm(false);
      setSaved("Đã kết luận báo cáo.");
      setReload((value) => value + 1);
    } catch (caught) {
      setConfirm(false);
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  /**
   * MOD-RP4 với outcome=dismissed: bác bỏ báo cáo mà không ẩn đối tượng.
   * Hành động luôn là `none` nên đối tượng bị báo cáo không bị ảnh hưởng.
   */
  async function dismiss() {
    setDismissing(true);
    setError("");
    try {
      await service.resolve(reportId, {
        outcome: "dismissed",
        resolutionAction: "none",
        resolutionNote: dismissNote.trim() || undefined,
        applyToRelatedReports: related,
      });
      setConfirmDismiss(false);
      setSaved("Đã bác bỏ báo cáo.");
      setReload((value) => value + 1);
    } catch (caught) {
      setConfirmDismiss(false);
      setError(getErrorMessage(caught));
    } finally {
      setDismissing(false);
    }
  }

  if (loading && !report) return <Skeleton />;
  if (!report)
    return (
      <Card title="Chưa tải được báo cáo">
        <Alert>{error}</Alert>
        <Button
          onClick={() => {
            setError("");
            setReload((value) => value + 1);
          }}
        >
          Thử lại
        </Button>
      </Card>
    );

  const actions = conclusionActions(report.targetType);
  const canClaim = report.status === "pending";
  const canResolve = report.status === "in_review";
  // Báo cáo đã kết luận thì không còn nút bác bỏ: MOD-RP4 chỉ nhận đơn đang mở.
  const canDismiss = canDismissReport(report.status);

  return (
    <div className="stack">
      <PageHeading
        title={`Báo cáo ${
          report.targetType === "restaurant" ? "nhà hàng" : "bài viết"
        }`}
        description="Đọc nội dung và ngữ cảnh trước khi kết luận."
      />

      {error && <Alert tone="warning">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card title="Thông tin báo cáo">
        <p>
          {report.reporter.displayName} ·{" "}
          {new Date(report.createdAt).toLocaleString("vi-VN")}
        </p>
        <p>
          <strong>
            {reasonLabels[report.reasonCode] ?? report.reasonCode}
          </strong>
        </p>
        {report.description && <p>{report.description}</p>}
        <Badge tone={reportStatusTone(report.status)}>
          {statusLabels[report.status]}
          {report.handledBy ? ` · ${report.handledBy.displayName}` : ""}
        </Badge>
        {canClaim && (
          <Button loading={busy} onClick={() => void claim()}>
            Nhận xử lý
          </Button>
        )}
        {/* Đơn chưa ai nhận thì chỉ có thể bác bỏ, không kết luận được. */}
        {canDismiss && !canResolve && (
          <Button
            variant="danger"
            loading={dismissing}
            onClick={() => setConfirmDismiss(true)}
          >
            Bác bỏ đơn
          </Button>
        )}
      </Card>

      {report.evidenceUrls.length > 0 && (
        <Card title="Bằng chứng">
          <ul className="owner-review-images">
            {report.evidenceUrls.map((url) => (
              <li key={url}>
                <img
                  className="owner-review-image"
                  src={url}
                  alt="Ảnh bằng chứng đính kèm"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Đối tượng bị báo cáo">
        <p>
          <strong>{report.targetName}</strong>
        </p>
        {report.reportCountOnTarget > 1 && (
          <p className="helper">
            Đối tượng này đang có {report.reportCountOnTarget} báo cáo đang mở.
          </p>
        )}
      </Card>

      {canResolve ? (
        <Card title="Kết luận báo cáo">
          <SelectField
            label="Một hành động kết luận"
            value={action}
            onChange={(value) => setAction(value as ResolutionAction)}
            options={actions.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
          />
          <TextArea
            label="Ghi chú kết luận"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
          />
          <Choice
            label="Áp dụng kết luận cho các báo cáo đang mở cùng đối tượng"
            checked={related}
            onChange={setRelated}
          />
          <div className="actions">
            <Button onClick={() => setConfirm(true)}>Kiểm tra và kết luận</Button>
            <Button
              variant="danger"
              onClick={() => setConfirmDismiss(true)}
            >
              Bác bỏ đơn
            </Button>
          </div>
        </Card>
      ) : report.resolutionNote ? (
        <Card title="Kết luận đã lưu">
          <p>{report.resolutionNote}</p>
        </Card>
      ) : (
        <Alert tone="info">
          {canDismiss
            ? "Chỉ người đã nhận xử lý mới có thể kết luận báo cáo."
            : "Báo cáo này đã có kết luận."}
        </Alert>
      )}

      {report.relatedReports.length > 0 && (
        <Card title="Báo cáo khác cùng đối tượng">
          <DataTable
            rows={report.relatedReports.map((item) => ({
              ...item,
              id: String(item.id),
            }))}
            caption="Báo cáo liên quan"
            columns={[
              {
                label: "Người báo cáo",
                render: (row) => row.reporter.displayName,
              },
              {
                label: "Lý do",
                render: (row) => reasonLabels[row.reasonCode] ?? row.reasonCode,
              },
              {
                label: "Trạng thái",
                render: (row) => statusLabels[row.status],
              },
              {
                label: "Mở",
                render: (row) => (
                  <ActionLink href={reportHref(base, row.id)} secondary>
                    Xem →
                  </ActionLink>
                ),
              },
            ]}
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        title="Xác nhận kết luận báo cáo?"
        destructive={action !== "none"}
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={() => void resolve()}
      >
        <p>
          {action === "none"
            ? "Ghi nhận báo cáo mà không ẩn đối tượng."
            : actions.find((item) => item.value === action)?.label}
          {related && " Áp dụng cả các báo cáo đang mở cùng đối tượng."}
        </p>
        <p>{note}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDismiss}
        title="Xác nhận bác bỏ báo cáo?"
        danger
        loading={dismissing}
        label="Bác bỏ đơn"
        onClose={() => setConfirmDismiss(false)}
        onConfirm={() => void dismiss()}
      >
        <p>
          Báo cáo sẽ được đánh dấu là đã bác bỏ. Đối tượng bị báo cáo không bị
          ẩn hay xử phạt.
          {related && " Các báo cáo đang mở cùng đối tượng cũng bị bác bỏ."}
        </p>
        <TextArea
          label="Lý do bác bỏ"
          value={dismissNote}
          onChange={(event) => setDismissNote(event.target.value)}
          maxLength={1000}
        />
      </ConfirmDialog>
    </div>
  );
}
