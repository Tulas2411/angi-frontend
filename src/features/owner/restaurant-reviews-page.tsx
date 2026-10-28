"use client";
import { useEffect, useMemo, useState } from "react";
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
import { PageHeading } from "@/components/layout/page-heading";
import { relativeTimeLabel } from "@/shared/format";
import {
  REPLY_MAX_LENGTH,
  canReply,
  ownerReviewFieldErrors,
  ownerReviewsErrorMessage,
  ownerReviewsQuery,
  replyRequest,
  replyStatusLabels,
  validateReplyContent,
  type OwnerRatingFilter,
  type OwnerReplyFilter,
} from "./owner-reviews-rules";
import {
  ownerReviewsService,
} from "./owner-reviews-service";
import type { ReviewDto, ReviewReplyDto } from "./owner-reviews-types";
import "./restaurant-reviews.css";

/** Số đánh giá hiển thị trên mỗi trang. */
const PAGE_SIZE = 10;
const REPLY_FIELD_ID = "owner-reply-field";

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
          className="owner-reviews-star-icon"
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

function ReviewItem({
  review,
  busy,
  onReply,
}: {
  review: ReviewDto;
  busy: boolean;
  onReply: (review: ReviewDto) => void;
}) {
  const visible = canReply(review.status);
  return (
    <li className="owner-review">
      <div className="owner-review-main">
        <Avatar name={review.user.displayName} image={review.user.avatarUrl} />
        <div className="owner-review-heading">
          <strong>{review.user.displayName}</strong>
          <div className="owner-review-meta">
            <span>{relativeTimeLabel(review.createdAt)}</span>
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
                alt={`Ảnh thực khách ${review.user.displayName} đăng kèm, ảnh ${index + 1}`}
              />
            </li>
          ))}
        </ul>
      )}

      {review.reply && (
        <div className="owner-review-reply">
          <div className="owner-review-reply-head">
            <strong>Phản hồi của Bếp Nhà</strong>
            <Badge
              tone={
                review.reply.status === "visible"
                  ? "success"
                  : review.reply.status === "hidden"
                    ? "warning"
                    : "error"
              }
            >
              {replyStatusLabels[review.reply.status]}
            </Badge>
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
          disabled={!visible || busy}
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

/**
 * Trang "Lắng nghe thực khách" của chủ nhà hàng — OWN-19 và OWN-20.
 *
 * Danh sách, bộ lọc và phân trang đều do backend quyết định: mỗi thay đổi bộ
 * lọc gọi lại OWN-19 với `replied`/`rating`/`page` tương ứng.
 */
export function RestaurantReviewsPage() {
  const service = ownerReviewsService;
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [replyFilter, setReplyFilter] = useState<OwnerReplyFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<OwnerRatingFilter>("all");
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState<ReviewDto | null>(null);
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  /** Khoá của lần tải đã hoàn tất; khác `requestKey` nghĩa là đang tải. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const query = useMemo(
    () => ownerReviewsQuery(replyFilter, ratingFilter, page, PAGE_SIZE),
    [replyFilter, ratingFilter, page],
  );

  /** Mỗi bộ lọc, trang hay lần thử lại đều là một khoá tải khác nhau. */
  const requestKey = `${replyFilter}|${ratingFilter}|${page}|${attempt}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let ignore = false;
    service
      .list(query)
      .then((result) => {
        if (ignore) return;
        setReviews(result.items);
        setTotalItems(result.totalItems);
        setTotalPages(Math.max(1, result.totalPages));
        setError("");
        setLoadedKey(requestKey);
      })
      .catch((caught) => {
        if (ignore) return;
        setError(ownerReviewsErrorMessage(caught));
        setLoadedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [service, query, requestKey]);

  /** Đưa tiêu điểm về ô nhập khi báo lỗi để người dùng sửa ngay. */
  function focusReplyField() {
    document.getElementById(REPLY_FIELD_ID)?.focus();
  }

  function changeFilter<T>(setter: (value: T) => void) {
    return (value: string) => {
      setter(value as T);
      setPage(1);
      setSaved("");
    };
  }

  function openReply(review: ReviewDto) {
    setEditing(review);
    setText(review.reply?.content ?? "");
    setFieldError("");
    setError("");
    setSaved("");
  }

  function closeReply() {
    setEditing(null);
    setText("");
    setFieldError("");
  }

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    const invalid = validateReplyContent(text);
    setFieldError(invalid ?? "");
    if (invalid) {
      focusReplyField();
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const reply: ReviewReplyDto = await service.reply(
        editing.id,
        replyRequest(text),
      );
      const hadReply = !!editing.reply;
      setReviews((current) =>
        current.map((review) =>
          review.id === editing.id ? { ...review, reply } : review,
        ),
      );
      const author = editing.user.displayName;
      closeReply();
      setSaved(
        hadReply
          ? `Đã cập nhật phản hồi tới ${author}.`
          : `Đã gửi phản hồi tới ${author}.`,
      );
    } catch (caught) {
      const fields = ownerReviewFieldErrors(caught);
      const fieldMessage = fields.content ?? "";
      setFieldError(fieldMessage);
      setError(ownerReviewsErrorMessage(caught));
      if (fieldMessage) focusReplyField();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack owner-reviews">
      <PageHeading
        eyebrow="Nhà hàng của tôi"
        title="Lắng nghe thực khách"
        description="Đọc đánh giá và phản hồi từng trải nghiệm."
      />

      {saved && <Alert tone="success">{saved}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Card title="Bộ lọc">
        <div className="owner-reviews-filters">
          <SelectField
            label="Phản hồi"
            value={replyFilter}
            onChange={changeFilter(setReplyFilter)}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "unanswered", label: "Chưa phản hồi" },
              { value: "answered", label: "Đã phản hồi" },
            ]}
          />
          <SelectField
            label="Số sao"
            value={String(ratingFilter)}
            onChange={changeFilter(setRatingFilter)}
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

      <Card title={`${totalItems} đánh giá`}>
        {loading ? (
          <Skeleton />
        ) : reviews.length === 0 ? (
          <EmptyState title="Không có đánh giá phù hợp">
            Thử đổi bộ lọc để xem thêm đánh giá của thực khách.
          </EmptyState>
        ) : (
          <ul className="owner-reviews-list">
            {reviews.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                busy={busy}
                onReply={openReply}
              />
            ))}
          </ul>
        )}
      </Card>

      {!loading && totalPages > 1 && (
        <Pagination
          total={totalItems}
          page={page}
          size={PAGE_SIZE}
          onChange={(value) => {
            setPage(value);
            setSaved("");
          }}
        />
      )}

      {error && !loading && (
        <div className="actions">
          <Button
            variant="secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </Button>
        </div>
      )}

      <Dialog
        open={!!editing}
        onClose={closeReply}
        focusField
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
            maxLength={REPLY_MAX_LENGTH}
            rows={6}
            required
          />
        </form>
      </Dialog>
    </div>
  );
}
