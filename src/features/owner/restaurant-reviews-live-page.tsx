"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  Avatar,
  Dialog,
  EmptyState,
  Pagination,
  SelectField,
  Skeleton,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { getErrorMessage } from "@/shared/api/error";
import {
  ownerReviewsService,
  type OwnerReviewsService,
} from "./owner-reviews-service";
import type {
  OwnerReviewDto,
  OwnerReviewReplyDto,
  OwnerReviewsPageDto,
} from "./owner-reviews-types";
import "./restaurant-reviews.css";

const REPLY_MAX = 1000;
const REPLY_FIELD_ID = "owner-reply-field";
/** Số đánh giá hiển thị trên mỗi trang. */
const PAGE_SIZE = 10;

/** OWN-19 chỉ lọc theo "đã phản hồi" và số sao; BE tự sắp xếp mới nhất trước. */
type ReplyFilter = "all" | "unanswered" | "answered";

/** Dải sao trang trí; số sao thật luôn có nhãn chữ bên cạnh. */
function Stars({ rating, large = false }: { rating: number; large?: boolean }) {
  return (
    <span
      className={`owner-reviews-stars${large ? " owner-reviews-stars-lg" : ""}`}
      role="img"
      aria-label={`${rating} trên 5 sao`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <svg
          key={value}
          className="owner-review-star-icon"
          viewBox="0 0 24 24"
          aria-hidden
          focusable="false"
        >
          <path
            d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.05-5.8 3.05 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
            fill="currentColor"
            opacity={value <= rating ? 1 : 0.28}
          />
        </svg>
      ))}
    </span>
  );
}

/** Tổng quan tính từ chính trang đang tải, không suy diễn số liệu toàn hệ thống. */
function RatingSummary({ reviews }: { reviews: OwnerReviewDto[] }) {
  const visible = reviews.filter((review) => review.status === "visible");
  const ratingAvg = visible.length
    ? visible.reduce((sum, review) => sum + review.rating, 0) / visible.length
    : 0;
  const breakdown = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: visible.filter((review) => review.rating === rating).length,
  }));
  const peak = Math.max(1, ...breakdown.map((item) => item.count));
  const answered = reviews.filter((review) => !!review.reply).length;
  return (
    <Card title="Tổng quan đánh giá">
      <div className="owner-reviews-summary">
        <div className="owner-reviews-score">
          <span className="owner-reviews-score-value">
            {ratingAvg.toFixed(1)}
          </span>
          <div className="owner-reviews-score-meta">
            <Stars rating={Math.round(ratingAvg)} large />
            <span className="owner-reviews-score-count">
              {visible.length} đánh giá đang hiển thị
            </span>
          </div>
        </div>
        <ul className="owner-reviews-breakdown">
          {breakdown.map((item) => (
            <li key={item.rating} className="owner-reviews-breakdown-row">
              <span>{item.rating} sao</span>
              <span
                className="owner-reviews-breakdown-track"
                role="img"
                aria-label={`${item.rating} sao: ${item.count} đánh giá`}
              >
                <span
                  className="owner-reviews-breakdown-fill"
                  style={{ width: `${(item.count / peak) * 100}%` }}
                />
              </span>
              <span className="owner-reviews-breakdown-count">{item.count}</span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="owner-reviews-counts">
        <div className="owner-reviews-count">
          <dt>Đã phản hồi</dt>
          <dd>{answered}</dd>
        </div>
        <div className="owner-reviews-count">
          <dt>Chưa phản hồi</dt>
          <dd>{reviews.length - answered}</dd>
        </div>
        <div className="owner-reviews-count">
          <dt>Đang bị ẩn</dt>
          <dd>{reviews.length - visible.length}</dd>
        </div>
      </dl>
    </Card>
  );
}

function ReviewItem({
  review,
  onReply,
}: {
  review: OwnerReviewDto;
  onReply: (review: OwnerReviewDto) => void;
}) {
  const visible = review.status === "visible";
  return (
    <li className="owner-review">
      <div className="owner-review-main">
        <Avatar
          name={review.user.displayName}
          image={review.user.avatarUrl}
        />
        <div className="owner-review-heading">
          <strong>{review.user.displayName}</strong>
          <div className="owner-review-meta">
            <span>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</span>
          </div>
        </div>
        <div className="owner-review-rating">
          <Stars rating={review.rating} />
          <span className="helper">{review.rating} / 5</span>
        </div>
      </div>

      {!visible && (
        <p className="owner-review-hidden">
          Nội dung đánh giá đang bị ẩn nên nhà hàng không thể phản hồi. Chỉ hiển
          thị với người kiểm duyệt của ANGI.
        </p>
      )}
      {visible && review.content && (
        <p className="owner-review-text">{review.content}</p>
      )}

      {visible && review.images.length > 0 && (
        <ul className="owner-review-images">
          {review.images.map((image, index) => (
            <li key={image}>
              <img
                className="owner-review-image"
                src={image}
                alt={`Ảnh thực khách đăng kèm, ảnh ${index + 1}`}
              />
            </li>
          ))}
        </ul>
      )}

      {review.reply && (
        <div className="owner-review-reply">
          <div className="owner-review-reply-head">
            <strong>Phản hồi của Bếp Nhà</strong>
            {review.reply.status === "visible" ? (
              <Badge tone="success">Đang hiển thị</Badge>
            ) : (
              <Badge tone="warning">Đang chờ kiểm duyệt</Badge>
            )}
          </div>
          <p className="owner-review-reply-text">{review.reply.content}</p>
          {review.reply.status !== "visible" && (
            <p className="helper owner-review-reply-note">
              Phản hồi đang chờ người kiểm duyệt của ANGI duyệt trước khi hiển
              thị với thực khách.
            </p>
          )}
        </div>
      )}
      <div className="owner-review-actions">
        <Button
          variant={review.reply ? "secondary" : "primary"}
          disabled={!visible}
          onClick={() => onReply(review)}
        >
          {review.reply ? "Sửa phản hồi" : "Phản hồi"}
        </Button>
        {!visible && (
          <span className="helper">Chỉ phản hồi đánh giá đang hiển thị.</span>
        )}
      </div>
    </li>
  );
}

export function RestaurantReviewsLivePage() {
  const service: OwnerReviewsService = ownerReviewsService;
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    key: string;
    data: OwnerReviewsPageDto;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<ReplyFilter>("all");
  const [stars, setStars] = useState("all");
  const [editing, setEditing] = useState<OwnerReviewDto | null>(null);
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  /** "unanswered" là `replied=false`; "answered" là `replied=true`; "all" thì không lọc. */
  const replied =
    filter === "unanswered" ? false : filter === "answered" ? true : undefined;
  const rating = stars === "all" ? undefined : Number(stars);

  /** Bộ lọc hiện tại là chìa khoá của lần tải; tải xong mới hiện dữ liệu. */
  const queryKey = `${replied}|${rating}|${page}|${attempt}`;
  const loading = result?.key !== queryKey;
  const data = result?.key === queryKey ? result.data : null;

  useEffect(() => {
    let ignore = false;
    service
      .list({ replied, rating, page, pageSize: PAGE_SIZE })
      .then((response) => {
        if (ignore) return;
        setResult({
          key: `${replied}|${rating}|${page}|${attempt}`,
          data: response,
        });
      })
      .catch((caught) => {
        if (ignore) return;
        setError(getErrorMessage(caught));
      });
    return () => {
      ignore = true;
    };
  }, [service, replied, rating, page, attempt]);

  /** Đưa tiêu điểm về ô nhập khi báo lỗi để người dùng sửa ngay. */
  function focusReplyField() {
    document.getElementById(REPLY_FIELD_ID)?.focus();
  }

  function changeFilter<T>(setter: (value: T) => void) {
    return (value: string) => {
      setter(value as T);
      setPage(1);
    };
  }

  function openReply(review: OwnerReviewDto) {
    setEditing(review);
    setText(review.reply?.content ?? "");
    setFieldError("");
    setSaved("");
  }

  function closeReply() {
    setEditing(null);
    setText("");
    setFieldError("");
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const content = text.trim();
    if (!content) {
      setFieldError("Phản hồi không được để trống.");
      focusReplyField();
      return;
    }
    if (content.length > REPLY_MAX) {
      setFieldError(`Phản hồi không vượt quá ${REPLY_MAX} ký tự.`);
      focusReplyField();
      return;
    }
    setBusy(true);
    setFieldError("");
    try {
      const reply: OwnerReviewReplyDto = await service.reply(editing.id, {
        content,
      });
      setResult((current) =>
        current
          ? {
              ...current,
              data: {
                ...current.data,
                items: current.data.items.map((review) =>
                  review.id === editing.id ? { ...review, reply } : review,
                ),
              },
            }
          : current,
      );
      setSaved(`Đã gửi phản hồi tới ${editing.user.displayName}.`);
      closeReply();
    } catch (caught) {
      setFieldError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => data?.items ?? [], [data]);

  if (loading && !data) return <Skeleton />;
  if (!data && error)
    return (
      <Card title="Chưa tải được đánh giá">
        <Alert>{error}</Alert>
        <Button
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Thử lại
        </Button>
      </Card>
    );

  return (
    <div className="stack owner-reviews">
      <PageHeading
        title="Lắng nghe thực khách"
        description="Đọc đánh giá và phản hồi từng trải nghiệm."
      />

      {error && <Alert tone="warning">{error}</Alert>}
      {saved && <Alert tone="success">{saved}</Alert>}

      <RatingSummary reviews={rows} />

      <Card title="Bộ lọc">
        <div className="owner-reviews-filters">
          <SelectField
            label="Phản hồi"
            value={filter}
            onChange={changeFilter(setFilter)}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "unanswered", label: "Chưa phản hồi" },
              { value: "answered", label: "Đã phản hồi" },
            ]}
          />
          <SelectField
            label="Số sao"
            value={stars}
            onChange={changeFilter(setStars)}
            options={[
              { value: "all", label: "Mọi mức sao" },
              ...[5, 4, 3, 2, 1].map((value) => ({
                value: String(value),
                label: `${value} sao`,
              })),
            ]}
          />
        </div>
      </Card>

      <Card title={`${data?.totalItems ?? 0} đánh giá`}>
        {rows.length === 0 ? (
          <EmptyState title="Không có đánh giá phù hợp">
            Thử đổi bộ lọc để xem thêm đánh giá của thực khách.
          </EmptyState>
        ) : (
          <ul className="owner-reviews-list">
            {rows.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                onReply={openReply}
              />
            ))}
          </ul>
        )}
      </Card>

      {(data?.totalPages ?? 0) > 1 && (
        <Pagination
          total={data?.totalItems ?? 0}
          page={page}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      <Dialog
        open={!!editing}
        onClose={closeReply}
        title={`Phản hồi ${editing?.user.displayName ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={closeReply}>
              Hủy
            </Button>
            <Button type="submit" form="owner-reply-form" loading={busy}>
              Lưu phản hồi
            </Button>
          </>
        }
      >
        <form
          id="owner-reply-form"
          className="owner-reviews-dialog-form"
          onSubmit={submitReply}
        >
          <p className="owner-reviews-dialog-note">
            Phản hồi hiển thị dưới tên <strong>Bếp Nhà</strong> và được người
            kiểm duyệt của ANGI duyệt trước khi hiện với thực khách. Hãy tránh
            thông tin cá nhân và giữ giọng điệu lịch sự.
          </p>
          <TextArea
            id={REPLY_FIELD_ID}
            label="Phản hồi của nhà hàng"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (fieldError) setFieldError("");
            }}
            error={fieldError}
            helper="Cảm ơn thực khách và cho biết bước tiếp theo bạn sẽ làm."
            maxLength={REPLY_MAX}
            rows={6}
            required
          />
        </form>
      </Dialog>
    </div>
  );
}
