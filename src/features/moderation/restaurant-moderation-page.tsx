"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon,
  FlagIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  Avatar,
  Choice,
  Dialog,
  EmptyState,
  Field,
  Media,
  Pagination,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { money } from "@/shared/format";
import { useRemote } from "@/features/explore/use-remote";
import { verificationDateLabel } from "@/features/owner/verification-details";
import { dishFormLabels } from "@/features/owner/menu-rules";
import type { OwnerMenuDishDto } from "@/features/owner/menu-types";
import { operatingStatusLabels } from "@/features/owner/operating-status-rules";
import type { OperatingStatus } from "@/features/owner/restaurant-types";
import {
  moderationLabels,
  verificationLabels,
} from "@/features/owner/status-labels";
import {
  reportReasonLabels,
  reportStatusLabels,
} from "./report-handling-rules";
import { conclusionActions, reportStatusTone } from "./moderation-service";
import type { ReportDto, ResolutionAction } from "./moderation-types";
import {
  auditLabel,
  isOpenReport,
  moderationChoices,
  moderationStatusTabs,
  moderationTone,
  operatingFilterOptions,
  operatingTone,
  reasonMax,
  reasonProblem,
  restaurantModerationError,
  verificationFilterOptions,
  verificationTone,
} from "./restaurant-moderation-rules";
import {
  restaurantModerationService,
  type RestaurantModerationService,
} from "./restaurant-moderation-service";
import type {
  ModRestaurantDetailDto,
  RestaurantModerationStatus,
  RestaurantVerificationStatus,
} from "./restaurant-moderation-types";
import "./verification-review.css";
import "./menu-review.css";
import "./restaurant-moderation.css";

const pageSize = 20;

const place = (restaurant: {
  addressLine?: string | null;
  ward?: string | null;
  provinceName: string | null;
}) =>
  [restaurant.addressLine, restaurant.ward, restaurant.provinceName]
    .filter(Boolean)
    .join(", ");

/** F-56 list (MOD-R1): every restaurant, unverified and hidden ones included. */
export function RestaurantModerationListPage({
  service = restaurantModerationService,
}: {
  service?: RestaurantModerationService;
}) {
  const { base } = useWorkspace();
  const [moderation, setModeration] = useState<"" | RestaurantModerationStatus>(
    "",
  );
  const [verification, setVerification] = useState<
    "" | RestaurantVerificationStatus
  >("");
  const [operating, setOperating] = useState<"" | OperatingStatus>("");
  const [reported, setReported] = useState(false);
  const [qDraft, setQDraft] = useState("");
  const [provinceDraft, setProvinceDraft] = useState("");
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [page, setPage] = useState(1);
  // Typed filters are asked for 400 ms after the last key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(qDraft.trim());
      setProvince(provinceDraft.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [qDraft, provinceDraft]);
  const [list, retry] = useRemote(
    () =>
      service.list({
        q: q || undefined,
        province: province || undefined,
        moderationStatus: moderation || undefined,
        verificationStatus: verification || undefined,
        operatingStatus: operating || undefined,
        hasPendingReports: reported || undefined,
        page,
        pageSize,
      }),
    [q, province, moderation, verification, operating, reported, page].join(
      ":",
    ),
  );

  return (
    <div className="stack vr-page">
      <PageHeading
        title="Kiểm duyệt nhà hàng"
        description="Tìm quán bị báo cáo hoặc có thông tin sai, xem hồ sơ, thực đơn và lịch sử, rồi ẩn, đình chỉ hoặc hiển thị lại."
      />
      <div className="vr-toolbar">
        <div
          className="vr-tabs"
          role="group"
          aria-label="Trạng thái kiểm duyệt"
        >
          {moderationStatusTabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              aria-pressed={moderation === tab.value}
              onClick={() => {
                setModeration(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Choice
          label="Chỉ quán có báo cáo chờ xử lý"
          checked={reported}
          onChange={(checked) => {
            setReported(checked);
            setPage(1);
          }}
        />
      </div>
      <div className="rm-filters">
        <Field
          label="Tên quán"
          type="search"
          value={qDraft}
          placeholder="Ví dụ: Phở Bờ Hồ"
          autoComplete="off"
          onChange={(event) => setQDraft(event.target.value)}
        />
        <ProvinceField
          label="Tỉnh / thành phố"
          type="search"
          value={provinceDraft}
          showCatalogStatus={false}
          autoComplete="off"
          onChange={setProvinceDraft}
        />
        <SelectField
          label="Xác minh"
          value={verification}
          options={verificationFilterOptions}
          onChange={(value) => {
            setVerification(value as "" | RestaurantVerificationStatus);
            setPage(1);
          }}
        />
        <SelectField
          label="Hoạt động"
          value={operating}
          options={[...operatingFilterOptions]}
          onChange={(value) => {
            setOperating(value as "" | OperatingStatus);
            setPage(1);
          }}
        />
      </div>
      {list.status === "loading" && <Skeleton rows={4} />}
      {list.status === "error" && (
        <Card title="Chưa tải được danh sách nhà hàng">
          <Alert>{restaurantModerationError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {list.status === "ready" &&
        (list.data.items.length === 0 ? (
          <EmptyState title="Không có nhà hàng nào">
            Không có quán nào khớp bộ lọc hiện tại.
          </EmptyState>
        ) : (
          <section className="stack-sm" aria-label="Nhà hàng">
            <p className="helper" role="status">
              {list.data.totalItems} nhà hàng
            </p>
            <ul className="vr-queue">
              {list.data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${base}/restaurants/${item.id}`}
                    className="vr-card"
                  >
                    <Media
                      className="vr-card-photo"
                      src={item.coverUrl ?? undefined}
                      alt=""
                    />
                    <span className="vr-card-body">
                      <span className="vr-card-head">
                        <strong>{item.name}</strong>
                        <Badge tone={moderationTone[item.moderationStatus]}>
                          {moderationLabels[item.moderationStatus]}
                        </Badge>
                        <Badge tone={verificationTone[item.verificationStatus]}>
                          {verificationLabels[item.verificationStatus]}
                        </Badge>
                      </span>
                      {place(item) && (
                        <small>
                          <MapPinIcon aria-hidden />
                          {place(item)}
                        </small>
                      )}
                      <span className="vr-card-facts">
                        <span data-tone={operatingTone[item.operatingStatus]}>
                          {operatingStatusLabels[item.operatingStatus]}
                        </span>
                        <span>
                          <StarIcon aria-hidden />
                          {item.ratingCount
                            ? `${Number(item.ratingAvg).toFixed(1)} · ${item.ratingCount} đánh giá`
                            : "Chưa có đánh giá"}
                        </span>
                      </span>
                    </span>
                    <span
                      className="rm-card-reports"
                      data-active={item.pendingReportCount > 0}
                    >
                      <span className="rm-report-pill">
                        <FlagIcon aria-hidden />
                        {item.pendingReportCount > 0
                          ? `${item.pendingReportCount} báo cáo chờ`
                          : "Không có báo cáo"}
                      </span>
                      <ChevronRightIcon
                        className="rm-card-chevron"
                        aria-hidden
                      />
                    </span>
                  </Link>
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

type DetailTab = "profile" | "menu" | "reports" | "history";

/** MOD-R4 dialog: hide or show one dish with a reason. */
function DishDialog({
  dish,
  service,
  onClose,
  onDone,
}: {
  dish: OwnerMenuDishDto | null;
  service: RestaurantModerationService;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const hiding = dish?.status !== "hidden";

  async function save() {
    if (!dish || busy.current) return;
    const found = reasonProblem(reason);
    setError(found);
    if (found) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      await service.updateDish(dish.id, {
        status: hiding ? "hidden" : "active",
        reason: reason.trim(),
      });
      setReason("");
      onDone(
        hiding
          ? `Đã ẩn món ${dish.name}. Khách không còn thấy món này.`
          : `Đã hiển thị lại món ${dish.name}.`,
      );
    } catch (caught) {
      setProblem(restaurantModerationError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!dish}
      title={dish ? `${hiding ? "Ẩn" : "Hiển thị lại"} món ${dish.name}?` : ""}
      onClose={() => {
        if (!saving) {
          setError("");
          setProblem("");
          onClose();
        }
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant={hiding ? "destructive" : "primary"}
            loading={saving}
            onClick={() => void save()}
          >
            {hiding ? "Ẩn món" : "Hiển thị lại"}
          </Button>
        </>
      }
    >
      <div className="stack-sm">
        <p>
          {hiding
            ? "Món bị ẩn khỏi thực đơn công khai, tìm kiếm và gợi ý; chủ quán vẫn thấy món trong thực đơn của mình."
            : "Món xuất hiện lại trong thực đơn công khai và gợi ý."}
        </p>
        <TextArea
          label="Lý do"
          required
          value={reason}
          maxLength={reasonMax}
          placeholder={
            hiding
              ? "Ví dụ: Ảnh món không đúng thực tế."
              : "Ví dụ: Chủ quán đã thay ảnh đúng với món."
          }
          error={error}
          helper={`${reason.trim().length}/${reasonMax} ký tự.`}
          onChange={(event) => {
            setReason(event.target.value);
            setError("");
          }}
        />
        {problem && <Alert>{problem}</Alert>}
      </div>
    </Dialog>
  );
}

/** MOD-RP4 dialog: conclude one report on this restaurant. */
function ReportDialog({
  report,
  service,
  onClose,
  onDone,
}: {
  report: ReportDto | null;
  service: RestaurantModerationService;
  onClose: () => void;
  onDone: (message: string, closed: boolean) => void;
}) {
  const [outcome, setOutcome] = useState<"resolved" | "dismissed">("resolved");
  const [action, setAction] = useState<ResolutionAction>("none");
  const [note, setNote] = useState("");
  const [related, setRelated] = useState(true);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const actions = conclusionActions("restaurant");

  async function save() {
    if (!report || busy.current) return;
    if (note.trim().length > 1000) {
      setProblem("Ghi chú không được vượt quá 1000 ký tự.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      await service.resolveReport(report.id, {
        outcome,
        resolutionAction: outcome === "dismissed" ? "none" : action,
        resolutionNote: note.trim() || undefined,
        applyToRelatedReports: related,
      });
      setNote("");
      onDone(
        outcome === "dismissed"
          ? `Đã bác bỏ báo cáo #${report.id}.`
          : `Đã giải quyết báo cáo #${report.id}.`,
        false,
      );
    } catch (caught) {
      setProblem(restaurantModerationError(caught));
      if (caught instanceof ApiError && caught.errorCode === "REPORT_CLOSED")
        onDone(restaurantModerationError(caught), true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!report}
      title={report ? `Xử lý báo cáo #${report.id}` : ""}
      onClose={() => {
        if (!saving) {
          setProblem("");
          onClose();
        }
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button
            variant={
              outcome === "resolved" && action !== "none"
                ? "destructive"
                : "primary"
            }
            loading={saving}
            onClick={() => void save()}
          >
            {outcome === "dismissed" ? "Bác bỏ báo cáo" : "Giải quyết báo cáo"}
          </Button>
        </>
      }
    >
      {report && (
        <div className="stack-sm">
          <p className="helper">
            {reportReasonLabels[report.reasonCode] ?? report.reasonCode} · gửi
            bởi {report.reporter.displayName}
            {report.description && `: “${report.description}”`}
          </p>
          <div
            className="vr-decisions"
            role="radiogroup"
            aria-label="Kết luận báo cáo"
          >
            <label data-choice="approve">
              <input
                type="radio"
                name="report-outcome"
                checked={outcome === "resolved"}
                onChange={() => setOutcome("resolved")}
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
                checked={outcome === "dismissed"}
                onChange={() => setOutcome("dismissed")}
              />
              <span>
                <strong>Bác bỏ</strong>
                <small>Quán không vi phạm; không có hành động nào.</small>
              </span>
            </label>
          </div>
          {outcome === "resolved" && (
            <SelectField
              label="Hành động với quán"
              value={action}
              options={actions}
              onChange={(value) => setAction(value as ResolutionAction)}
            />
          )}
          <TextArea
            label="Ghi chú xử lý (không bắt buộc)"
            value={note}
            maxLength={1000}
            placeholder="Ví dụ: Đã kiểm tra, quán đổi giờ mở cửa nhưng chưa cập nhật."
            helper={`${note.trim().length}/1000 ký tự. Người báo cáo và chủ quán nhận thông báo.`}
            onChange={(event) => setNote(event.target.value)}
          />
          {report.reportCountOnTarget > 1 && (
            <Choice
              label={`Đóng luôn các báo cáo đang mở khác về quán này (${report.reportCountOnTarget} báo cáo)`}
              checked={related}
              onChange={setRelated}
            />
          )}
          {problem && <Alert>{problem}</Alert>}
        </div>
      )}
    </Dialog>
  );
}

function ReportRow({
  report,
  base,
  onHandle,
}: {
  report: ReportDto;
  base: string;
  onHandle: (report: ReportDto) => void;
}) {
  const open = isOpenReport(report.status);
  return (
    <li className="rm-report" data-open={open}>
      <div className="rm-report-head">
        <strong>
          {reportReasonLabels[report.reasonCode] ?? report.reasonCode}
        </strong>
        <Badge tone={reportStatusTone(report.status)}>
          {reportStatusLabels[report.status]}
        </Badge>
        <span className="helper">
          #{report.id} · {verificationDateLabel(report.createdAt)}
        </span>
      </div>
      <p className="rm-report-by">
        <Avatar
          name={report.reporter.displayName}
          image={report.reporter.avatarUrl}
        />
        {report.reporter.displayName}
      </p>
      {report.description && (
        <p className="rm-report-text">{report.description}</p>
      )}
      {report.evidenceUrls.length > 0 && (
        <ul className="vr-gallery" aria-label="Ảnh bằng chứng">
          {report.evidenceUrls.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                <Media src={url} alt={`Bằng chứng báo cáo #${report.id}`} />
              </a>
            </li>
          ))}
        </ul>
      )}
      {!open && (report.handledBy || report.resolutionNote) && (
        <p className="helper">
          {report.handledBy && `Xử lý bởi ${report.handledBy.displayName}`}
          {report.handledAt && ` · ${verificationDateLabel(report.handledAt)}`}
          {report.resolutionNote && ` · “${report.resolutionNote}”`}
        </p>
      )}
      <div className="rm-report-actions">
        <Link href={`${base}/reports/${report.id}`}>Mở trang báo cáo</Link>
        {open && (
          <Button variant="secondary" onClick={() => onHandle(report)}>
            Xử lý báo cáo
          </Button>
        )}
      </div>
    </li>
  );
}

/** F-56 detail (MOD-R2) with MOD-R3 (restaurant), MOD-R4 (dish) and MOD-RP4 (report). */
export function RestaurantModerationDetailPage({
  restaurantId,
  service = restaurantModerationService,
}: {
  restaurantId: number;
  service?: RestaurantModerationService;
}) {
  const { base } = useWorkspace();
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.detail(restaurantId),
    `${restaurantId}:${version}`,
  );
  const [tab, setTab] = useState<DetailTab>("profile");
  const [status, setStatus] = useState<RestaurantModerationStatus | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [reportId, setReportId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const [dish, setDish] = useState<OwnerMenuDishDto | null>(null);
  const [report, setReport] = useState<ReportDto | null>(null);
  const busy = useRef(false);
  const reload = () => setVersion((value) => value + 1);

  const back = (
    <Link className="vr-back" href={`${base}/restaurants`}>
      <ArrowLeftIcon aria-hidden /> Danh sách nhà hàng
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
      state.error.errorCode === "RESTAURANT_NOT_FOUND";
    return (
      <div className="stack vr-page">
        {back}
        <Card
          title={missing ? "Không tìm thấy nhà hàng" : "Chưa tải được nhà hàng"}
        >
          <Alert>{restaurantModerationError(state.error)}</Alert>
          {!missing && <Button onClick={retry}>Thử lại</Button>}
        </Card>
      </div>
    );
  }
  const item: ModRestaurantDetailDto = state.data;
  const chosen = status ?? item.moderationStatus;
  const openReports = item.reports.filter((entry) =>
    isOpenReport(entry.status),
  );
  const hiddenDishes = item.dishes.filter(
    (entry) => entry.status === "hidden",
  ).length;
  const tabs: { value: DetailTab; label: string }[] = [
    { value: "profile", label: "Hồ sơ" },
    { value: "menu", label: `Thực đơn (${item.dishes.length})` },
    { value: "reports", label: `Báo cáo (${item.reports.length})` },
    { value: "history", label: "Lịch sử" },
  ];
  const choice = moderationChoices.find((entry) => entry.value === chosen)!;

  function ask() {
    const found = reasonProblem(reason);
    setReasonError(found);
    setProblem("");
    if (!found) setConfirming(true);
  }

  async function save() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      const result = await service.updateStatus(restaurantId, {
        moderationStatus: chosen,
        reason: reason.trim(),
        ...(reportId ? { reportId: Number(reportId) } : {}),
      });
      setDone(
        `Đã chuyển ${item.name} sang “${moderationLabels[result.moderationStatus]}”. Chủ quán đã nhận thông báo kèm lý do.`,
      );
      setConfirming(false);
      setReason("");
      setReportId("");
      setStatus(null);
      reload();
    } catch (caught) {
      setProblem(restaurantModerationError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="stack vr-page">
      {back}
      <header className="vr-hero">
        <Media
          className="vr-hero-photo"
          src={item.coverUrl ?? undefined}
          alt={item.name}
        />
        <div>
          <p className="vr-eyebrow">Nhà hàng #{item.id}</p>
          <h1>{item.name}</h1>
          <p className="vr-hero-meta">
            <Badge tone={moderationTone[item.moderationStatus]}>
              {moderationLabels[item.moderationStatus]}
            </Badge>
            <Badge tone={verificationTone[item.verificationStatus]}>
              {verificationLabels[item.verificationStatus]}
            </Badge>
            <Badge tone={operatingTone[item.operatingStatus]}>
              {operatingStatusLabels[item.operatingStatus]}
            </Badge>
            {place(item) && (
              <span>
                <MapPinIcon aria-hidden /> {place(item)}
              </span>
            )}
            {openReports.length > 0 && (
              <span className="rm-hero-flag">
                <FlagIcon aria-hidden /> {openReports.length} báo cáo đang mở
              </span>
            )}
          </p>
        </div>
      </header>
      {done && <Alert tone="success">{done}</Alert>}
      {problem && !confirming && <Alert>{problem}</Alert>}

      <div className="vr-layout">
        <div className="vr-main">
          <div className="vr-tabs" role="group" aria-label="Nội dung nhà hàng">
            {tabs.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tab === option.value}
                onClick={() => setTab(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {tab === "profile" && (
            <>
              <Card title="Hồ sơ quán">
                <dl className="vr-facts">
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{place(item) || "Chưa có"}</dd>
                  </div>
                  <div>
                    <dt>Điện thoại</dt>
                    <dd>{item.phone || "Chưa có"}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{item.email || "Chưa có"}</dd>
                  </div>
                  <div>
                    <dt>Website</dt>
                    <dd>
                      {item.website ? (
                        <a href={item.website} target="_blank" rel="noreferrer">
                          {item.website}
                        </a>
                      ) : (
                        "Chưa có"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Mức giá</dt>
                    <dd>
                      {item.priceLevel
                        ? "₫".repeat(item.priceLevel)
                        : "Chưa có"}
                    </dd>
                  </div>
                  <div>
                    <dt>Đánh giá</dt>
                    <dd>
                      {item.ratingCount
                        ? `${Number(item.ratingAvg).toFixed(1)} / 5 · ${item.ratingCount} đánh giá`
                        : "Chưa có đánh giá"}
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày tạo</dt>
                    <dd>{verificationDateLabel(item.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Cập nhật gần nhất</dt>
                    <dd>{verificationDateLabel(item.updatedAt)}</dd>
                  </div>
                </dl>
                {item.description && (
                  <p className="vr-description">{item.description}</p>
                )}
                {item.images.length > 0 && (
                  <ul className="vr-gallery" aria-label="Ảnh của nhà hàng">
                    {item.images.map((url) => (
                      <li key={url}>
                        <Media src={url} alt={`Ảnh ${item.name}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Chủ quán">
                <div className="rm-owner">
                  <Avatar
                    name={item.owner.displayName}
                    image={item.owner.avatarUrl}
                  />
                  <div>
                    <strong>{item.owner.displayName}</strong>
                    <small>{item.owner.email}</small>
                  </div>
                  <Link href={`${base}/users/${item.owner.id}`}>
                    Xem người dùng
                  </Link>
                </div>
                <dl className="vr-facts">
                  <div>
                    <dt>Trạng thái tài khoản</dt>
                    <dd>
                      {item.owner.status === "active"
                        ? "Đang hoạt động"
                        : item.owner.status === "suspended"
                          ? `Tạm khóa${item.owner.suspendedUntil ? ` đến ${verificationDateLabel(item.owner.suspendedUntil)}` : ""}`
                          : item.owner.status === "banned"
                            ? "Bị cấm"
                            : item.owner.status}
                    </dd>
                  </div>
                  <div>
                    <dt>Đăng nhập gần nhất</dt>
                    <dd>{verificationDateLabel(item.owner.lastLoginAt)}</dd>
                  </div>
                </dl>
              </Card>
            </>
          )}

          {tab === "menu" && (
            <Card title="Thực đơn đang chạy">
              <p className="helper">
                Gồm cả món đang bị ẩn
                {hiddenDishes ? ` (${hiddenDishes} món)` : ""}. Ẩn một món vi
                phạm không cần ẩn cả quán.
              </p>
              {item.dishes.length === 0 ? (
                <p className="helper">Quán chưa có món nào.</p>
              ) : (
                <ul className="mr-items">
                  {item.dishes.map((entry) => (
                    <li
                      key={entry.id}
                      className="rm-dish"
                      data-hidden={entry.status === "hidden"}
                    >
                      <Media
                        className="mr-photo"
                        src={entry.coverUrl ?? undefined}
                        alt={entry.name}
                      />
                      <div className="mr-item-body">
                        <div className="mr-item-head">
                          <strong>{entry.name}</strong>
                          {entry.status === "hidden" && (
                            <Badge tone="warning">Bị ẩn</Badge>
                          )}
                          {!entry.isAvailable && (
                            <Badge tone="neutral">Tạm hết</Badge>
                          )}
                        </div>
                        <p className="mr-item-meta">
                          <strong>{money(entry.price)}</strong> ·{" "}
                          {dishFormLabels[entry.dishForm]} · {entry.likeCount}{" "}
                          lượt thích
                        </p>
                      </div>
                      <Button variant="tertiary" onClick={() => setDish(entry)}>
                        {entry.status === "hidden" ? (
                          <>
                            <EyeIcon className="vr-icon" aria-hidden /> Hiện lại
                          </>
                        ) : (
                          <>
                            <EyeSlashIcon className="vr-icon" aria-hidden /> Ẩn
                            món
                          </>
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "reports" && (
            <Card title="Báo cáo về quán">
              {item.reports.length === 0 ? (
                <p className="helper">Chưa có ai báo cáo quán này.</p>
              ) : (
                <ul className="rm-reports">
                  {item.reports.map((entry) => (
                    <ReportRow
                      key={entry.id}
                      report={entry}
                      base={base}
                      onHandle={setReport}
                    />
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "history" && (
            <Card title="Lịch sử thay đổi">
              {item.recentAudit.length === 0 ? (
                <p className="helper">Chưa có thay đổi nào được ghi lại.</p>
              ) : (
                <ol className="rm-audit">
                  {item.recentAudit.map((entry) => (
                    <li key={entry.id}>
                      <strong>{auditLabel(entry.action)}</strong>
                      <small>
                        {entry.actor
                          ? `${entry.actor.displayName}${entry.actor.role ? ` (${entry.actor.role})` : ""}`
                          : "Hệ thống"}
                        {" · "}
                        <ClockIcon aria-hidden />
                        {verificationDateLabel(entry.createdAt)}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        <aside className="vr-side" aria-label="Trạng thái hiển thị">
          <Card title="Trạng thái hiển thị">
            <div
              className="vr-decisions rm-choices"
              role="radiogroup"
              aria-label="Trạng thái hiển thị của quán"
            >
              {moderationChoices.map((entry) => (
                <label key={entry.value} data-choice={entry.value}>
                  <input
                    type="radio"
                    name="restaurant-moderation"
                    checked={chosen === entry.value}
                    onChange={() => {
                      setStatus(entry.value);
                      setReasonError("");
                    }}
                  />
                  <span>
                    <strong>
                      {entry.label}
                      {item.moderationStatus === entry.value && " (hiện tại)"}
                    </strong>
                    <small>{entry.hint}</small>
                  </span>
                </label>
              ))}
            </div>
            {chosen !== item.moderationStatus && (
              <>
                <TextArea
                  label="Lý do"
                  required
                  value={reason}
                  maxLength={reasonMax}
                  placeholder={
                    chosen === "visible"
                      ? "Ví dụ: Quán đã sửa thông tin theo yêu cầu."
                      : "Ví dụ: Nhiều báo cáo về vệ sinh an toàn thực phẩm."
                  }
                  error={reasonError}
                  helper={`${reason.trim().length}/${reasonMax} ký tự. Chủ quán sẽ thấy lý do này.`}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError("");
                  }}
                />
                {openReports.length > 0 && (
                  <SelectField
                    label="Báo cáo liên quan (không bắt buộc)"
                    value={reportId}
                    options={[
                      { value: "", label: "Không gắn báo cáo" },
                      ...openReports.map((entry) => ({
                        value: String(entry.id),
                        label: `#${entry.id} · ${reportReasonLabels[entry.reasonCode] ?? entry.reasonCode}`,
                      })),
                    ]}
                    onChange={setReportId}
                  />
                )}
              </>
            )}
            <Button
              variant={chosen === "visible" ? "primary" : "destructive"}
              disabled={chosen === item.moderationStatus}
              onClick={ask}
            >
              {chosen === item.moderationStatus
                ? "Chọn trạng thái mới"
                : `${choice.label}`}
            </Button>
            <Button variant="tertiary" onClick={reload}>
              <ArrowPathIcon className="vr-icon" aria-hidden /> Tải lại
            </Button>
          </Card>
        </aside>
      </div>

      <Dialog
        open={confirming}
        title={`${choice.label}: ${item.name}?`}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button
              variant={chosen === "visible" ? "primary" : "danger"}
              loading={saving}
              onClick={() => void save()}
            >
              {choice.label}
            </Button>
          </>
        }
      >
        <div className="stack-sm">
          <p>{choice.hint}</p>
          <div className="vr-previous-note">
            <strong>Lý do gửi chủ quán</strong>
            <p>{reason.trim()}</p>
          </div>
          {problem && <Alert>Chưa lưu được. {problem}</Alert>}
        </div>
      </Dialog>

      <DishDialog
        dish={dish}
        service={service}
        onClose={() => setDish(null)}
        onDone={(message) => {
          setDish(null);
          setDone(message);
          reload();
        }}
      />
      <ReportDialog
        report={report}
        service={service}
        onClose={() => setReport(null)}
        onDone={(message, closed) => {
          setReport(null);
          if (closed) setProblem(message);
          else setDone(message);
          reload();
        }}
      />
    </div>
  );
}
