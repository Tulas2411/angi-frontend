"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChatBubbleLeftEllipsisIcon,
  EyeIcon,
  EyeSlashIcon,
  MapPinIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  Avatar,
  Dialog,
  EmptyState,
  Field,
  Pagination,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { PhotoLightbox } from "@/components/ui/photo-lightbox";
import { SlidingSegment } from "@/components/ui/sliding-segment";
import { PageHeading } from "@/components/layout/workspace";
import { useRemote } from "@/features/explore/use-remote";
import { verificationDateLabel } from "@/features/owner/verification-details";
import {
  actionEffect,
  actionLabels,
  contentStatusLabels,
  contentStatusTone,
  nextStatuses,
  ratingFilterOptions,
  reasonMax,
  reasonProblem,
  reviewModerationError,
  reviewStatusTabs,
  type ModerationTarget,
} from "./review-moderation-rules";
import {
  reviewModerationService,
  type ReviewModerationService,
} from "./review-moderation-service";
import type { ContentStatus, ModReviewDto } from "./review-moderation-types";
import "./verification-review.css";
import "./review-moderation.css";

const pageSize = 20;

const actionIcons = {
  visible: EyeIcon,
  hidden: EyeSlashIcon,
  removed: TrashIcon,
} as const;

interface Pending {
  review: ModReviewDto;
  target: ModerationTarget;
  status: ContentStatus;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="rv-stars" aria-label={`${rating} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          data-on={star <= rating || undefined}
          aria-hidden
        />
      ))}
    </span>
  );
}

function Actions({
  current,
  label,
  onPick,
}: {
  current: ContentStatus;
  label: string;
  onPick: (status: ContentStatus) => void;
}) {
  return (
    <div className="rv-actions" role="group" aria-label={label}>
      {nextStatuses(current).map((status) => {
        const ActionIcon = actionIcons[status];
        return (
          <button
            key={status}
            type="button"
            data-action={status}
            onClick={() => onPick(status)}
          >
            <ActionIcon aria-hidden /> {actionLabels[status]}
          </button>
        );
      })}
    </div>
  );
}

function ReviewCard({
  review,
  onAct,
  onPhoto,
}: {
  review: ModReviewDto;
  onAct: (pending: Pending) => void;
  onPhoto: (index: number) => void;
}) {
  const place = [review.restaurant.ward, review.restaurant.provinceName]
    .filter(Boolean)
    .join(", ");
  return (
    <li className="rv-card" data-status={review.status}>
      <header className="rv-head">
        <Avatar name={review.user.displayName} image={review.user.avatarUrl} />
        <div className="rv-who">
          <strong>{review.user.displayName}</strong>
          <small>{verificationDateLabel(review.createdAt)}</small>
        </div>
        <Stars rating={review.rating} />
        <Badge tone={contentStatusTone[review.status]}>
          {contentStatusLabels[review.status]}
        </Badge>
      </header>

      <p className="rv-place">
        <MapPinIcon aria-hidden />
        <strong>{review.restaurant.name}</strong>
        {place && <span>· {place}</span>}
      </p>

      {review.content ? (
        <p className="rv-content">{review.content}</p>
      ) : (
        <p className="rv-content rv-empty">
          Chỉ chấm sao, không viết nội dung.
        </p>
      )}

      {review.images.length > 0 && (
        <ul className="rv-photos" aria-label="Ảnh trong đánh giá">
          {review.images.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                aria-label={`Xem lớn ảnh ${index + 1}`}
                onClick={() => onPhoto(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Actions
        current={review.status}
        label="Xử lý đánh giá"
        onPick={(status) => onAct({ review, target: "review", status })}
      />

      {review.reply && (
        <div className="rv-reply" data-status={review.reply.status}>
          <div className="rv-reply-head">
            <ChatBubbleLeftEllipsisIcon aria-hidden />
            <strong>Phản hồi của chủ quán</strong>
            <small>{verificationDateLabel(review.reply.updatedAt)}</small>
            <Badge tone={contentStatusTone[review.reply.status]}>
              {contentStatusLabels[review.reply.status]}
            </Badge>
          </div>
          <p>{review.reply.content}</p>
          <Actions
            current={review.reply.status}
            label="Xử lý phản hồi"
            onPick={(status) => onAct({ review, target: "reply", status })}
          />
        </div>
      )}
    </li>
  );
}

/** Moderate User Feedback (MOD-F1..MOD-F3): restaurant reviews and the owners' replies. */
export function ReviewModerationPage({
  service = reviewModerationService,
}: {
  service?: ReviewModerationService;
}) {
  const [status, setStatus] = useState<"" | ContentStatus>("visible");
  const [rating, setRating] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  // The search is asked for 400 ms after the last key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(qDraft.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [qDraft]);
  const [list, retry] = useRemote(
    () =>
      service.list({
        q: q || undefined,
        status: status || undefined,
        rating: rating ? Number(rating) : undefined,
        page,
        pageSize,
      }),
    [q, status, rating, page, version].join(":"),
  );

  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [photos, setPhotos] = useState<{
    urls: string[];
    index: number;
  } | null>(null);
  const busy = useRef(false);

  function close() {
    if (saving) return;
    setPending(null);
    setReason("");
    setReasonError("");
    setProblem("");
  }

  async function save() {
    if (!pending || busy.current) return;
    const found = reasonProblem(reason);
    setReasonError(found);
    if (found) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      const request = { status: pending.status, reason: reason.trim() };
      if (pending.target === "review")
        await service.updateReview(pending.review.id, request);
      else await service.updateReply(pending.review.id, request);
      const what =
        pending.target === "review"
          ? `đánh giá của ${pending.review.user.displayName}`
          : `phản hồi của chủ quán ${pending.review.restaurant.name}`;
      setDone(
        `Đã ${actionLabels[pending.status].toLowerCase()} ${what}. Lý do đã được lưu vào nhật ký kiểm duyệt.`,
      );
      setPending(null);
      setReason("");
      setVersion((value) => value + 1);
    } catch (caught) {
      setProblem(reviewModerationError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const severe = pending?.status === "removed";

  return (
    <div className="stack vr-page">
      <PageHeading
        title="Đánh giá & phản hồi"
        description="Xem đánh giá của khách và phản hồi của chủ quán, ẩn hoặc gỡ nội dung vi phạm."
      />
      <div className="vr-toolbar rv-toolbar">
        <SlidingSegment
          className="vr-tabs"
          role="group"
          aria-label="Trạng thái đánh giá"
        >
          {reviewStatusTabs.map((tab) => (
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
        <div className="rv-filters">
          <Field
            label="Tìm kiếm"
            type="search"
            value={qDraft}
            placeholder="Nội dung đánh giá hoặc tên quán"
            autoComplete="off"
            onChange={(event) => setQDraft(event.target.value)}
          />
          <SelectField
            label="Số sao"
            value={rating}
            options={ratingFilterOptions}
            onChange={(value) => {
              setRating(value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {done && <Alert tone="success">{done}</Alert>}

      {list.status === "loading" && <Skeleton rows={4} />}
      {list.status === "error" && (
        <Card title="Chưa tải được danh sách đánh giá">
          <Alert>{reviewModerationError(list.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {list.status === "ready" &&
        (list.data.items.length === 0 ? (
          <EmptyState title="Không có đánh giá nào">
            Không có đánh giá nào khớp bộ lọc hiện tại.
          </EmptyState>
        ) : (
          <section className="stack-sm" aria-label="Đánh giá">
            <p className="helper" role="status">
              {list.data.totalItems} đánh giá
            </p>
            <ul className="rv-list">
              {list.data.items.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onAct={(next) => {
                    setDone("");
                    setPending(next);
                  }}
                  onPhoto={(index) => setPhotos({ urls: review.images, index })}
                />
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

      <Dialog
        open={!!pending}
        title={
          pending
            ? `${actionLabels[pending.status]} ${pending.target === "review" ? "đánh giá" : "phản hồi của chủ quán"}?`
            : ""
        }
        onClose={close}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Hủy
            </Button>
            <Button
              variant={
                severe
                  ? "danger"
                  : pending?.status === "hidden"
                    ? "destructive"
                    : "primary"
              }
              loading={saving}
              onClick={() => void save()}
            >
              {pending ? actionLabels[pending.status] : ""}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="stack-sm">
            <p>{actionEffect(pending.target, pending.status)}</p>
            <blockquote className="rv-quote">
              {pending.target === "review"
                ? pending.review.content || `${pending.review.rating} sao`
                : pending.review.reply?.content}
            </blockquote>
            <TextArea
              label="Lý do"
              required
              value={reason}
              maxLength={reasonMax}
              placeholder={
                pending.status === "visible"
                  ? "Ví dụ: Đã xem lại, nội dung không vi phạm."
                  : "Ví dụ: Nội dung quảng cáo, không liên quan tới quán."
              }
              error={reasonError}
              helper="Lý do được lưu vào nhật ký kiểm duyệt."
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError("");
              }}
            />
            {problem && <Alert>{problem}</Alert>}
          </div>
        )}
      </Dialog>

      <PhotoLightbox
        photos={(photos?.urls ?? []).map((url, index) => ({
          url,
          alt: `Ảnh ${index + 1} trong đánh giá`,
        }))}
        index={photos?.index ?? null}
        onIndexChange={(index) =>
          setPhotos((current) => (current ? { ...current, index } : current))
        }
        onClose={() => setPhotos(null)}
      />
    </div>
  );
}
