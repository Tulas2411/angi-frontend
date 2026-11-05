"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  FlagIcon,
  HandRaisedIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  Avatar,
  Choice,
  ConfirmDialog,
  EmptyState,
  Media,
  Pagination,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { DateTimeField } from "@/components/ui/date-time-fields";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { useRemote } from "@/features/explore/use-remote";
import type { RestaurantCardDto } from "@/features/explore/explore-types";
import type { BlogDetailDto } from "@/features/blogs/blog-types";
import { verificationDateLabel } from "@/features/owner/verification-details";
import { operatingStatusLabels } from "@/features/owner/operating-status-rules";
import { waitingFor } from "./verification-review-rules";
import {
  isReportOpen,
  moderationReportsService,
  reportStatusTone,
  type ModerationReportsService,
} from "./moderation-service";
import type {
  ReportDetailDto,
  ReportDto,
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
} from "./moderation-types";
import {
  isStaleReportError,
  plainText,
  reasonFilterOptions,
  reasonLabel,
  reportHandlingError,
  reportStatusLabels,
  reportStatusTabs,
  reportTargetTabs,
  resolutionActionLabels,
  resolutionActionsFor,
  resolutionNoteMax,
  resolveProblems,
  resolveRequest,
  type ResolveForm,
} from "./report-handling-rules";
import { SlidingSegment } from "@/components/ui/sliding-segment";
import "./verification-review.css";
import "./report-handling.css";

const pageSize = 20;

const targetWord = (type: ReportTargetType) =>
  type === "restaurant" ? "nhà hàng" : "bài viết";

/** F-59 queue (MOD-RP1, MOD-RP3): reports of one target type, oldest open first by the BE. */
export function ReportQueuePage({
  service = moderationReportsService,
}: {
  service?: ModerationReportsService;
}) {
  const { base } = useWorkspace();
  const [targetType, setTargetType] = useState<ReportTargetType>("restaurant");
  const [status, setStatus] = useState<"" | ReportStatus>("pending");
  const [reason, setReason] = useState<"" | ReportReasonCode>("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [list, retry] = useRemote(
    () =>
      service.list({
        targetType,
        status: status || undefined,
        reasonCode: reason || undefined,
        page,
        pageSize,
      }),
    [targetType, status, reason, page, version].join(":"),
  );
  const [claiming, setClaiming] = useState<number | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const busy = useRef(false);

  async function claim(report: ReportDto) {
    if (busy.current) return;
    busy.current = true;
    setClaiming(report.id);
    setNotice(null);
    try {
      await service.claim(report.id);
      setNotice({
        tone: "success",
        text: `Đã nhận xử lý báo cáo #${report.id} về ${report.targetName}.`,
      });
    } catch (caught) {
      setNotice({ tone: "error", text: reportHandlingError(caught) });
    } finally {
      busy.current = false;
      setClaiming(null);
      setVersion((value) => value + 1);
    }
  }

  return (
    <div className="stack vr-page">
      <PageHeading
        title="Báo cáo vi phạm"
        description="Nhận báo cáo để Mod khác không xử lý trùng, đọc bằng chứng và thông tin đối tượng, rồi kết luận."
      />
      <div className="vr-toolbar rh-toolbar">
        <SlidingSegment
          className="vr-tabs"
          role="group"
          aria-label="Loại đối tượng"
        >
          {reportTargetTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={targetType === tab.value}
              onClick={() => {
                setTargetType(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </SlidingSegment>
        <SlidingSegment
          className="vr-tabs"
          role="group"
          aria-label="Trạng thái báo cáo"
        >
          {reportStatusTabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              aria-pressed={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </SlidingSegment>
        <div className="rh-reason">
          <SelectField
            label="Lý do"
            value={reason}
            options={reasonFilterOptions}
            onChange={(value) => {
              setReason(value as "" | ReportReasonCode);
              setPage(1);
            }}
          />
        </div>
      </div>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {list.status === "loading" && <Skeleton rows={4} />}
      {list.status === "error" && (
        <Card title="Chưa tải được hàng đợi báo cáo">
          <Alert>{reportHandlingError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {list.status === "ready" &&
        (list.data.items.length === 0 ? (
          <EmptyState title="Không có báo cáo nào">
            {status === "pending"
              ? `Không còn báo cáo ${targetWord(targetType)} nào chờ nhận.`
              : "Không có báo cáo nào khớp bộ lọc hiện tại."}
          </EmptyState>
        ) : (
          <section className="stack-sm" aria-label="Báo cáo">
            <p className="helper" role="status">
              {list.data.totalItems} báo cáo
            </p>
            <ul className="vr-queue">
              {list.data.items.map((item) => (
                <li key={item.id} className="vr-card rh-card">
                  <span className="vr-card-body">
                    <span className="vr-card-head">
                      <Link
                        className="rh-card-link"
                        href={`${base}/reports/${item.id}`}
                      >
                        {item.targetName}
                      </Link>
                      <Badge tone={reportStatusTone(item.status)}>
                        {reportStatusLabels[item.status]}
                      </Badge>
                      <span className="rh-reason-chip">
                        {reasonLabel(item.reasonCode)}
                      </span>
                    </span>
                    {item.description && (
                      <span className="rh-card-text">“{item.description}”</span>
                    )}
                    <span className="vr-card-facts">
                      <span>
                        <Avatar
                          name={item.reporter.displayName}
                          image={item.reporter.avatarUrl}
                        />
                        {item.reporter.displayName}
                      </span>
                      {item.reportCountOnTarget > 1 && (
                        <span className="rh-count">
                          <FlagIcon aria-hidden />
                          {item.reportCountOnTarget} báo cáo đang mở về{" "}
                          {targetWord(item.targetType)} này
                        </span>
                      )}
                      {item.handledBy && (
                        <span>
                          <HandRaisedIcon aria-hidden />
                          {item.handledBy.displayName}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="rh-card-side">
                    <span className="vr-card-wait">
                      <ClockIcon aria-hidden />
                      <strong>{waitingFor(item.createdAt)}</strong>
                      <small>{verificationDateLabel(item.createdAt)}</small>
                    </span>
                    {item.status === "pending" && (
                      <Button
                        variant="secondary"
                        loading={claiming === item.id}
                        onClick={() => void claim(item)}
                      >
                        Nhận xử lý
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {list.data.totalPages > 1 && (
              <Pagination
                total={list.data.totalItems}
                page={list.data.page}
                size={list.data.pageSize}
                onChange={setPage}
              />
            )}
          </section>
        ))}
    </div>
  );
}

/** The reported restaurant (RestaurantCard), with a link to F-56 to act on it. */
function RestaurantTarget({
  restaurant,
  base,
}: {
  restaurant: RestaurantCardDto;
  base: string;
}) {
  const place = [
    restaurant.addressLine,
    restaurant.ward,
    restaurant.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="rh-target">
      <Media
        className="rh-target-photo"
        src={restaurant.coverUrl ?? undefined}
        alt={restaurant.name}
      />
      <div className="rh-target-body">
        <strong>{restaurant.name}</strong>
        {place && (
          <small>
            <MapPinIcon aria-hidden /> {place}
          </small>
        )}
        <small>
          <StarIcon aria-hidden />
          {restaurant.ratingCount
            ? `${Number(restaurant.ratingAvg).toFixed(1)} · ${restaurant.ratingCount} đánh giá`
            : "Chưa có đánh giá"}
          {" · "}
          {operatingStatusLabels[restaurant.operatingStatus]}
          {restaurant.operatingStatus === "open" &&
            (restaurant.isOpenNow ? " · Đang mở cửa" : " · Đang ngoài giờ mở")}
        </small>
        <span className="rh-target-links">
          <Link href={`${base}/restaurants/${restaurant.id}`}>
            Hồ sơ, thực đơn và lịch sử quán
          </Link>
          <a
            href={`/restaurants/${restaurant.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Trang công khai <ArrowTopRightOnSquareIcon aria-hidden />
          </a>
        </span>
      </div>
    </div>
  );
}

/** The reported blog (BlogDetail). */
function BlogTarget({ blog }: { blog: BlogDetailDto }) {
  return (
    <div className="rh-target">
      <Media
        className="rh-target-photo"
        src={blog.coverUrl ?? undefined}
        alt={blog.title}
      />
      <div className="rh-target-body">
        <strong>{blog.title}</strong>
        <small>
          {blog.author.displayName} · {verificationDateLabel(blog.publishedAt)}
        </small>
        <small>
          <ChatBubbleLeftIcon aria-hidden /> {blog.commentCount} bình luận ·{" "}
          {blog.likeCount} lượt thích
        </small>
        {blog.excerpt && (
          <p className="rh-target-text">{plainText(blog.excerpt)}</p>
        )}
        <span className="rh-target-links">
          <a href={`/guides/${blog.id}`} target="_blank" rel="noreferrer">
            Mở bài viết <ArrowTopRightOnSquareIcon aria-hidden />
          </a>
        </span>
      </div>
    </div>
  );
}

const emptyForm: ResolveForm = {
  outcome: "resolved",
  action: "none",
  note: "",
  suspendUntil: "",
};

/** F-59 handling (MOD-RP2 + MOD-RP3 + MOD-RP4): evidence, target, related reports, conclusion. */
export function ReportHandlingPage({
  reportId,
  service = moderationReportsService,
}: {
  reportId: number;
  service?: ModerationReportsService;
}) {
  const { base, user } = useWorkspace();
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.detail(reportId),
    `${reportId}:${version}`,
  );
  const [form, setForm] = useState<ResolveForm>(emptyForm);
  const [related, setRelated] = useState(true);
  const [problems, setProblems] = useState<ReturnType<typeof resolveProblems>>(
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const busy = useRef(false);
  const reload = () => setVersion((value) => value + 1);

  const back = (
    <Link className="vr-back" href={`${base}/reports`}>
      <ArrowLeftIcon aria-hidden /> Hàng đợi báo cáo
    </Link>
  );
  if (state.status === "loading")
    return (
      <div className="stack vr-page">
        {back}
        <Skeleton rows={6} />
      </div>
    );
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      state.error.errorCode === "REPORT_NOT_FOUND";
    return (
      <div className="stack vr-page">
        {back}
        <Card
          title={missing ? "Không tìm thấy báo cáo" : "Chưa tải được báo cáo"}
        >
          <Alert>{reportHandlingError(state.error)}</Alert>
          {!missing && <Button onClick={retry}>Thử lại</Button>}
        </Card>
      </div>
    );
  }
  const report: ReportDetailDto = state.data;
  const open = isReportOpen(report.status);
  const mine = !!user && report.handledBy?.id === user.id;
  const takenByOther = report.status === "in_review" && !mine;
  const actions = resolutionActionsFor(report.targetType);
  const update = (patch: Partial<ResolveForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setProblems({});
  };

  async function claim() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      await service.claim(reportId);
      setDone(
        "Bạn đã nhận xử lý báo cáo này. Mod khác sẽ thấy báo cáo đang được xử lý.",
      );
    } catch (caught) {
      setProblem(reportHandlingError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
      reload();
    }
  }

  function ask() {
    const found = resolveProblems(form);
    setProblems(found);
    setProblem("");
    if (!Object.keys(found).length) setConfirming(true);
  }

  async function resolve() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      const result = await service.resolve(
        reportId,
        resolveRequest(form, related),
      );
      setDone(
        result.status === "dismissed"
          ? "Đã bác bỏ báo cáo. Người báo cáo đã nhận thông báo."
          : `Đã giải quyết báo cáo: ${resolutionActionLabels[result.resolutionAction ?? "none"].toLowerCase()}. Người báo cáo và ${report.targetType === "restaurant" ? "chủ quán" : "tác giả"} đã nhận thông báo.`,
      );
      setConfirming(false);
      setForm(emptyForm);
      reload();
    } catch (caught) {
      setProblem(reportHandlingError(caught));
      if (isStaleReportError(caught)) {
        setConfirming(false);
        reload();
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const chosenAction = form.outcome === "dismissed" ? "none" : form.action;
  const severe = chosenAction !== "none";

  return (
    <div className="stack vr-page">
      {back}
      <header className="vr-hero rh-hero">
        <div>
          <p className="vr-eyebrow">
            Báo cáo #{report.id} · {targetWord(report.targetType)}
          </p>
          <h1>{report.targetName}</h1>
          <p className="vr-hero-meta">
            <Badge tone={reportStatusTone(report.status)}>
              {reportStatusLabels[report.status]}
            </Badge>
            <span className="rh-reason-chip">
              {reasonLabel(report.reasonCode)}
            </span>
            <span>
              <ClockIcon aria-hidden /> Gửi{" "}
              {verificationDateLabel(report.createdAt)}
              {open && ` · đã chờ ${waitingFor(report.createdAt)}`}
            </span>
            {report.reportCountOnTarget > 1 && (
              <span className="rh-count">
                <FlagIcon aria-hidden /> {report.reportCountOnTarget} báo cáo
                đang mở
              </span>
            )}
          </p>
        </div>
      </header>
      {done && <Alert tone="success">{done}</Alert>}
      {problem && !confirming && <Alert>{problem}</Alert>}

      <div className="vr-layout">
        <div className="vr-main">
          <Card title="Nội dung báo cáo">
            <p className="rh-reporter">
              <Avatar
                name={report.reporter.displayName}
                image={report.reporter.avatarUrl}
              />
              <span>
                <strong>{report.reporter.displayName}</strong>
                <small>{verificationDateLabel(report.createdAt)}</small>
              </span>
            </p>
            <p className="rh-description">
              {report.description || "Người báo cáo không ghi thêm mô tả."}
            </p>
            {report.evidenceUrls.length > 0 ? (
              <ul
                className="vr-gallery rh-evidence"
                aria-label="Ảnh bằng chứng"
              >
                {report.evidenceUrls.map((url, index) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <Media src={url} alt={`Bằng chứng ${index + 1}`} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper">Không có ảnh bằng chứng.</p>
            )}
          </Card>

          <Card
            className="rh-target-card"
            title={`${report.targetType === "restaurant" ? "Nhà hàng" : "Bài viết"} bị báo cáo`}
          >
            {report.targetType === "restaurant" ? (
              <RestaurantTarget
                restaurant={report.target as RestaurantCardDto}
                base={base}
              />
            ) : (
              <BlogTarget blog={report.target as BlogDetailDto} />
            )}
          </Card>

          <Card title="Báo cáo khác đang mở về cùng đối tượng">
            {report.relatedReports.length === 0 ? (
              <p className="helper">Không có báo cáo nào khác đang mở.</p>
            ) : (
              <ul className="rh-related">
                {report.relatedReports.map((item) => (
                  <li key={item.id}>
                    <Link href={`${base}/reports/${item.id}`}>
                      <span>
                        <strong>{reasonLabel(item.reasonCode)}</strong>
                        <small>
                          {item.reporter.displayName} ·{" "}
                          {verificationDateLabel(item.createdAt)}
                        </small>
                        {item.description && (
                          <small className="rh-related-text">
                            “{item.description}”
                          </small>
                        )}
                      </span>
                      <Badge tone={reportStatusTone(item.status)}>
                        {reportStatusLabels[item.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="vr-side" aria-label="Xử lý báo cáo">
          {!open ? (
            <Card title="Kết quả xử lý">
              <p>
                <Badge tone={reportStatusTone(report.status)}>
                  {reportStatusLabels[report.status]}
                </Badge>
              </p>
              <dl className="vr-facts">
                <div>
                  <dt>Hành động</dt>
                  <dd>
                    {resolutionActionLabels[report.resolutionAction ?? "none"]}
                  </dd>
                </div>
                <div>
                  <dt>Người xử lý</dt>
                  <dd>{report.handledBy?.displayName || "Chưa có"}</dd>
                </div>
                <div>
                  <dt>Thời điểm</dt>
                  <dd>{verificationDateLabel(report.handledAt)}</dd>
                </div>
              </dl>
              {report.resolutionNote && (
                <div className="vr-previous-note">
                  <strong>Ghi chú xử lý</strong>
                  <p>{report.resolutionNote}</p>
                </div>
              )}
              <Button variant="tertiary" onClick={reload}>
                <ArrowPathIcon className="vr-icon" aria-hidden /> Tải lại
              </Button>
            </Card>
          ) : report.status === "pending" ? (
            <Card title="Nhận xử lý">
              <p className="helper">
                Nhận báo cáo trước khi kết luận để Mod khác không xử lý trùng.
              </p>
              <Button loading={saving} onClick={() => void claim()}>
                <HandRaisedIcon className="vr-icon" aria-hidden /> Nhận xử lý
              </Button>
            </Card>
          ) : takenByOther ? (
            <Card title="Đang được xử lý">
              <Alert tone="info">
                {report.handledBy?.displayName ?? "Một Mod khác"} đã nhận báo
                cáo này
                {report.handledAt &&
                  ` lúc ${verificationDateLabel(report.handledAt)}`}
                . Chỉ người đã nhận mới kết luận.
              </Alert>
              <Button variant="tertiary" onClick={reload}>
                <ArrowPathIcon className="vr-icon" aria-hidden /> Tải lại
              </Button>
            </Card>
          ) : (
            <Card title="Kết luận">
              <div
                className="vr-decisions"
                role="radiogroup"
                aria-label="Kết luận báo cáo"
              >
                <label data-choice="approve">
                  <input
                    type="radio"
                    name="report-outcome"
                    checked={form.outcome === "resolved"}
                    onChange={() => update({ outcome: "resolved" })}
                  />
                  <span>
                    <strong>Báo cáo đúng</strong>
                    <small>Giải quyết và áp dụng hành động bên dưới.</small>
                  </span>
                </label>
                <label data-choice="reject">
                  <input
                    type="radio"
                    name="report-outcome"
                    checked={form.outcome === "dismissed"}
                    onChange={() => update({ outcome: "dismissed" })}
                  />
                  <span>
                    <strong>Bác bỏ</strong>
                    <small>
                      Không có vi phạm; {targetWord(report.targetType)} giữ
                      nguyên.
                    </small>
                  </span>
                </label>
              </div>
              {form.outcome === "resolved" && (
                <SelectField
                  label="Hành động"
                  value={form.action}
                  options={actions}
                  onChange={(value) =>
                    update({ action: value as ResolveForm["action"] })
                  }
                />
              )}
              {form.outcome === "resolved" &&
                form.action === "suspend_user" && (
                  <DateTimeField
                    label="Tạm khóa đến"
                    required
                    value={form.suspendUntil}
                    min={new Date().toISOString().slice(0, 10)}
                    placeholder="Chọn ngày"
                    error={problems.suspendUntil}
                    onChange={(value) => update({ suspendUntil: value })}
                  />
                )}
              <TextArea
                label="Ghi chú xử lý (không bắt buộc)"
                value={form.note}
                maxLength={resolutionNoteMax}
                placeholder={
                  form.outcome === "dismissed"
                    ? "Ví dụ: Đã kiểm tra, thông tin quán vẫn đúng."
                    : "Ví dụ: Ảnh bằng chứng cho thấy quán đã đóng cửa."
                }
                error={problems.note}
                helper="Người báo cáo sẽ thấy ghi chú này."
                onChange={(event) => update({ note: event.target.value })}
              />
              {report.relatedReports.length > 0 && (
                <Choice
                  label={`Kết luận luôn ${report.relatedReports.length} báo cáo đang mở khác về cùng đối tượng`}
                  checked={related}
                  onChange={setRelated}
                />
              )}
              <Button
                variant={severe ? "destructive" : "primary"}
                onClick={ask}
              >
                {form.outcome === "dismissed"
                  ? "Bác bỏ báo cáo"
                  : "Giải quyết báo cáo"}
              </Button>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title={
          form.outcome === "dismissed"
            ? `Bác bỏ báo cáo #${report.id}?`
            : `Giải quyết báo cáo #${report.id}?`
        }
        label={form.outcome === "dismissed" ? "Bác bỏ báo cáo" : "Giải quyết"}
        danger={severe}
        loading={saving}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        onConfirm={() => void resolve()}
      >
        <div className="stack-sm">
          <dl className="vr-facts">
            <div>
              <dt>Đối tượng</dt>
              <dd>{report.targetName}</dd>
            </div>
            <div>
              <dt>Hành động</dt>
              <dd>
                {actions.find((item) => item.value === chosenAction)?.label}
                {chosenAction === "suspend_user" &&
                  form.suspendUntil &&
                  ` đến ${new Date(form.suspendUntil).toLocaleString("vi-VN")}`}
              </dd>
            </div>
            {report.relatedReports.length > 0 && (
              <div>
                <dt>Báo cáo khác</dt>
                <dd>
                  {related
                    ? `Kết luận luôn ${report.relatedReports.length} báo cáo`
                    : "Giữ nguyên"}
                </dd>
              </div>
            )}
          </dl>
          {form.note.trim() && (
            <div className="vr-previous-note">
              <strong>Ghi chú xử lý</strong>
              <p>{form.note.trim()}</p>
            </div>
          )}
          {problem && <Alert>Chưa lưu được. {problem}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
