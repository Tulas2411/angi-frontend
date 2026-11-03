"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  DocumentTextIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ConfirmDialog,
  EmptyState,
  Media,
  Pagination,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { ApiError } from "@/shared/api/error";
import { useRemote } from "@/features/explore/use-remote";
import { verificationStatusLabels } from "@/features/owner/verification-rules";
import {
  verificationDateLabel,
  verificationDocumentUrl,
} from "@/features/owner/verification-details";
import type { VerificationDto } from "@/features/owner/verification-types";
import {
  decisionBody,
  decisionOptions,
  decisionProblem,
  documentLabel,
  dossierChanges,
  isImageUrl,
  queueTabs,
  reviewNoteMax,
  statusTone,
  verificationReviewError,
  waitingFor,
} from "./verification-review-rules";
import {
  verificationReviewService,
  type VerificationReviewService,
} from "./verification-review-service";
import type {
  VerificationDecision,
  VerificationQueueStatus,
} from "./verification-review-types";
import "./verification-review.css";

const pageSize = 20;

/** F-57 queue (MOD-V1): one tab per status, oldest dossier first, filtered by province. */
export function VerificationQueuePage({
  service = verificationReviewService,
}: {
  service?: VerificationReviewService;
}) {
  const { base } = useWorkspace();
  const [status, setStatus] = useState<VerificationQueueStatus>("pending");
  const [provinceDraft, setProvinceDraft] = useState("");
  const [province, setProvince] = useState("");
  const [page, setPage] = useState(1);
  // The province is asked for 400 ms after the last change, not on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProvince(provinceDraft.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [provinceDraft]);
  const [list, retry] = useRemote(
    () =>
      service.list({
        status,
        province: province || undefined,
        page,
        pageSize,
      }),
    `${status}:${province}:${page}`,
  );

  return (
    <div className="stack vr-page">
      <PageHeading
        title="Xác minh nhà hàng"
        description="Xem hồ sơ chủ quán gửi lên, đối chiếu giấy tờ và duyệt, yêu cầu bổ sung hoặc từ chối. Hồ sơ gửi sớm nhất ở trên cùng."
      />
      <div className="vr-toolbar">
        <div className="vr-tabs" role="group" aria-label="Trạng thái hồ sơ">
          {queueTabs.map((tab) => (
            <button
              key={tab.value}
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
        </div>
        <div className="vr-province">
          <ProvinceField
            label="Tỉnh / thành phố"
            type="search"
            value={provinceDraft}
            showCatalogStatus={false}
            autoComplete="off"
            onChange={setProvinceDraft}
          />
        </div>
      </div>
      {list.status === "loading" && <Skeleton rows={4} />}
      {list.status === "error" && (
        <Card title="Chưa tải được hàng đợi xác minh">
          <Alert>{verificationReviewError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {list.status === "ready" &&
        (list.data.items.length === 0 ? (
          <EmptyState title="Không có hồ sơ nào">
            {status === "pending"
              ? "Mọi hồ sơ chờ duyệt đã được xử lý."
              : "Chưa có hồ sơ nào ở trạng thái này."}
            {province && ` (lọc theo ${province})`}
          </EmptyState>
        ) : (
          <section className="stack-sm" aria-label="Hồ sơ xác minh">
            <p className="helper" role="status">
              {list.data.totalItems} hồ sơ
            </p>
            <ul className="vr-queue">
              {list.data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${base}/verification/${item.id}`}
                    className="vr-card"
                  >
                    <Media
                      className="vr-card-photo"
                      src={item.restaurant.coverUrl ?? undefined}
                      alt=""
                    />
                    <span className="vr-card-body">
                      <span className="vr-card-head">
                        <strong>{item.restaurant.name}</strong>
                        <Badge tone={statusTone(item.status)}>
                          {verificationStatusLabels[item.status]}
                        </Badge>
                        {item.previousId !== null && <Badge>Nộp lại</Badge>}
                      </span>
                      <small>
                        <MapPinIcon aria-hidden />
                        {[
                          item.restaurant.addressLine,
                          item.restaurant.provinceName,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </small>
                      <span className="vr-card-facts">
                        <span>{item.legalName}</span>
                        <span>GPKD {item.businessLicenseNo}</span>
                        <span>
                          <DocumentTextIcon aria-hidden />
                          {item.documents.length} giấy tờ
                        </span>
                      </span>
                    </span>
                    <span className="vr-card-wait">
                      <ClockIcon aria-hidden />
                      <strong>{waitingFor(item.submittedAt)}</strong>
                      <small>{verificationDateLabel(item.submittedAt)}</small>
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

/** The documents of a dossier: a preview for images, a link for the rest (signed, short-lived). */
function Documents({ verification }: { verification: VerificationDto }) {
  if (!verification.documents.length)
    return <p className="helper">Hồ sơ không có giấy tờ đính kèm.</p>;
  return (
    <ul className="vr-docs">
      {verification.documents.map((document, index) => {
        const url = verificationDocumentUrl(document.url);
        const label = documentLabel(document.docType);
        return (
          <li key={`${document.mediaId}-${index}`}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {isImageUrl(url) ? (
                  <Media className="vr-doc-preview" src={url} alt={label} />
                ) : (
                  <span className="vr-doc-file" aria-hidden>
                    <DocumentTextIcon />
                  </span>
                )}
                <span>
                  {label}
                  <small>
                    Mở tài liệu <ArrowTopRightOnSquareIcon aria-hidden />
                  </small>
                </span>
              </a>
            ) : (
              <span className="vr-doc-missing">
                {label} · Chưa có liên kết tài liệu
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** F-57 review (MOD-V2 + MOD-V3): the dossier, the restaurant, the previous dossier, the decision. */
export function VerificationReviewPage({
  verificationId,
  service = verificationReviewService,
}: {
  verificationId: number;
  service?: VerificationReviewService;
}) {
  const { base } = useWorkspace();
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.detail(verificationId),
    `${verificationId}:${version}`,
  );
  const [decision, setDecision] = useState<VerificationDecision>("approve");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const busy = useRef(false);

  const back = (
    <Link className="vr-back" href={`${base}/verification`}>
      <ArrowLeftIcon aria-hidden /> Hàng đợi xác minh
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
      state.error.errorCode === "VERIFICATION_NOT_FOUND";
    return (
      <div className="stack vr-page">
        {back}
        <Card title={missing ? "Không tìm thấy hồ sơ" : "Chưa tải được hồ sơ"}>
          <Alert>{verificationReviewError(state.error)}</Alert>
          {!missing && <Button onClick={retry}>Thử lại</Button>}
        </Card>
      </div>
    );
  }
  const item = state.data;
  const restaurant = item.restaurant;
  const open = item.status === "pending";
  const chosen = decisionOptions.find((option) => option.value === decision)!;

  function ask() {
    const found = decisionProblem(decision, note);
    setNoteError(found);
    setProblem("");
    if (!found) setConfirming(true);
  }

  async function decide() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      await service.decide(verificationId, decisionBody(decision, note));
      setConfirming(false);
      setDone(
        decision === "approve"
          ? `Đã duyệt hồ sơ. ${restaurant.name} đã được xác minh và chủ quán đã nhận thông báo.`
          : decision === "reject"
            ? "Đã từ chối hồ sơ. Chủ quán đã nhận lý do của bạn."
            : "Đã gửi yêu cầu bổ sung. Chủ quán sẽ nộp lại hồ sơ đã sửa.",
      );
      setNote("");
      setVersion((value) => value + 1);
    } catch (caught) {
      const reviewed =
        caught instanceof ApiError &&
        caught.errorCode === "VERIFICATION_ALREADY_REVIEWED";
      setProblem(verificationReviewError(caught));
      if (reviewed) {
        setConfirming(false);
        setVersion((value) => value + 1);
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const changes = item.previous ? dossierChanges(item, item.previous) : [];
  const address = [
    restaurant.addressLine,
    restaurant.ward,
    restaurant.provinceName,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="stack vr-page">
      {back}
      <header className="vr-hero">
        <Media
          className="vr-hero-photo"
          src={restaurant.coverUrl ?? undefined}
          alt={restaurant.name}
        />
        <div>
          <p className="vr-eyebrow">Hồ sơ xác minh #{item.id}</p>
          <h1>{restaurant.name}</h1>
          <p className="vr-hero-meta">
            <Badge tone={statusTone(item.status)}>
              {verificationStatusLabels[item.status]}
            </Badge>
            {item.previousId !== null && (
              <Badge>Nộp lại sau hồ sơ #{item.previousId}</Badge>
            )}
            <span>
              <ClockIcon aria-hidden /> Gửi{" "}
              {verificationDateLabel(item.submittedAt)}
              {open && ` · đã chờ ${waitingFor(item.submittedAt)}`}
            </span>
          </p>
        </div>
      </header>
      {done && <Alert tone="success">{done}</Alert>}
      {problem && !confirming && <Alert>{problem}</Alert>}

      <div className="vr-layout">
        <div className="vr-main">
          <Card title="Giấy tờ đính kèm">
            <Documents verification={item} />
            <p className="helper">
              Liên kết giấy tờ chỉ có hiệu lực trong thời gian ngắn. Nếu không
              mở được, hãy tải lại trang.
            </p>
          </Card>

          <Card title="Thông tin pháp lý">
            <dl className="vr-facts">
              <div>
                <dt>Tên pháp lý</dt>
                <dd>{item.legalName}</dd>
              </div>
              <div>
                <dt>Số giấy phép kinh doanh</dt>
                <dd>{item.businessLicenseNo}</dd>
              </div>
              <div>
                <dt>Mã số thuế</dt>
                <dd>{item.taxCode || "Chưa cung cấp"}</dd>
              </div>
              <div>
                <dt>Ghi chú của chủ quán</dt>
                <dd>{item.ownerNote || "Không có"}</dd>
              </div>
            </dl>
          </Card>

          {item.previous && (
            <Card title={`So với hồ sơ trước (#${item.previous.id})`}>
              {item.previous.reviewNote && (
                <div className="vr-previous-note">
                  <strong>
                    Phản hồi lần trước ·{" "}
                    {verificationStatusLabels[item.previous.status]}
                  </strong>
                  <p>{item.previous.reviewNote}</p>
                </div>
              )}
              <table className="vr-diff">
                <thead>
                  <tr>
                    <th scope="col">Mục</th>
                    <th scope="col">Hồ sơ trước</th>
                    <th scope="col">Hồ sơ này</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((row) => (
                    <tr key={row.label} data-changed={row.changed}>
                      <th scope="row">{row.label}</th>
                      <td>{row.before || "—"}</td>
                      <td>
                        {row.after || "—"}
                        {row.changed && <Badge tone="warning">Đã đổi</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card title="Thông tin nhà hàng">
            <dl className="vr-facts">
              <div>
                <dt>Địa chỉ</dt>
                <dd>{address || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Điện thoại</dt>
                <dd>{restaurant.phone || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{restaurant.email || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{restaurant.website || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Ngày tạo quán</dt>
                <dd>{verificationDateLabel(restaurant.createdAt)}</dd>
              </div>
            </dl>
            {restaurant.description && (
              <p className="vr-description">{restaurant.description}</p>
            )}
            {restaurant.images.length > 0 && (
              <ul className="vr-gallery" aria-label="Ảnh của nhà hàng">
                {restaurant.images.slice(0, 6).map((url) => (
                  <li key={url}>
                    <Media src={url} alt={`Ảnh ${restaurant.name}`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="vr-side" aria-label="Quyết định">
          {open ? (
            <Card title="Quyết định">
              <div
                className="vr-decisions"
                role="radiogroup"
                aria-label="Quyết định cho hồ sơ"
              >
                {decisionOptions.map((option) => (
                  <label key={option.value} data-choice={option.value}>
                    <input
                      type="radio"
                      name="decision"
                      value={option.value}
                      checked={decision === option.value}
                      onChange={() => {
                        setDecision(option.value);
                        setNoteError("");
                      }}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              <TextArea
                label={
                  decision === "approve"
                    ? "Ghi chú cho chủ quán (không bắt buộc)"
                    : decision === "reject"
                      ? "Lý do từ chối"
                      : "Thông tin cần bổ sung"
                }
                required={decision !== "approve"}
                value={note}
                maxLength={reviewNoteMax}
                placeholder={
                  decision === "approve"
                    ? "Ví dụ: Hồ sơ đầy đủ, chúc quán kinh doanh thuận lợi."
                    : decision === "reject"
                      ? "Ví dụ: Giấy phép kinh doanh không khớp tên quán."
                      : "Ví dụ: Bổ sung ảnh mặt tiền có biển hiệu rõ tên quán."
                }
                error={noteError}
                helper={`${note.trim().length}/${reviewNoteMax} ký tự. Chủ quán sẽ thấy nội dung này.`}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError("");
                }}
              />
              <Button
                variant={decision === "reject" ? "destructive" : "primary"}
                onClick={ask}
              >
                {chosen.confirm}
              </Button>
            </Card>
          ) : (
            <Card title="Kết quả xử lý">
              <p>
                <Badge tone={statusTone(item.status)}>
                  {verificationStatusLabels[item.status]}
                </Badge>
              </p>
              <dl className="vr-facts">
                <div>
                  <dt>Người duyệt</dt>
                  <dd>{item.reviewedBy?.displayName || "Chưa có"}</dd>
                </div>
                <div>
                  <dt>Thời điểm</dt>
                  <dd>{verificationDateLabel(item.reviewedAt)}</dd>
                </div>
              </dl>
              {item.reviewNote && (
                <div className="vr-previous-note">
                  <strong>Ghi chú gửi chủ quán</strong>
                  <p>{item.reviewNote}</p>
                </div>
              )}
              <Button
                variant="tertiary"
                onClick={() => setVersion((value) => value + 1)}
              >
                <ArrowPathIcon className="vr-icon" aria-hidden /> Tải lại
              </Button>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`${chosen.label} cho ${restaurant.name}?`}
        label={chosen.confirm}
        danger={decision === "reject"}
        loading={saving}
        onClose={() => {
          if (!saving) setConfirming(false);
        }}
        onConfirm={() => void decide()}
      >
        <div className="stack-sm">
          <p>{chosen.hint}</p>
          {note.trim() && (
            <div className="vr-previous-note">
              <strong>Ghi chú gửi chủ quán</strong>
              <p>{note.trim()}</p>
            </div>
          )}
          {problem && <Alert>Chưa lưu được. {problem}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
