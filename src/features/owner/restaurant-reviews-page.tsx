"use client";
import { useMemo, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  Avatar,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Pagination,
  SelectField,
  TextArea,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { dateLabel, pageSlice, relativeTimeLabel } from "@/features/platform/rules";
import {
  ownerReviewsSeed,
  summarizeOwnerReviews,
  type OwnerReviewSeed,
} from "@/mocks/owner-reviews";
import "./restaurant-reviews.css";

const REPLY_MAX = 1000;
const REPLY_FIELD_ID = "owner-reply-field";
/** Số đánh giá hiển thị trên mỗi trang. */
const PAGE_SIZE = 10;

type SortValue = "newest" | "oldest" | "highest" | "lowest";
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

function RatingSummary({ reviews }: { reviews: OwnerReviewSeed[] }) {
  const summary = summarizeOwnerReviews(reviews);
  const peak = Math.max(1, ...summary.breakdown.map((item) => item.count));
  return (
    <Card title="Tổng quan đánh giá">
      <div className="owner-reviews-summary">
        <div className="owner-reviews-score">
          <span className="owner-reviews-score-value">
            {summary.ratingAvg.toFixed(1)}
          </span>
          <div className="owner-reviews-score-meta">
            <Stars rating={Math.round(summary.ratingAvg)} large />
            <span className="owner-reviews-score-count">
              {summary.visible} đánh giá đang hiển thị
            </span>
          </div>
        </div>
        <ul className="owner-reviews-breakdown">
          {summary.breakdown.map((item) => (
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
          <dd>{summary.answered}</dd>
        </div>
        <div className="owner-reviews-count">
          <dt>Chưa phản hồi</dt>
          <dd>{summary.unanswered}</dd>
        </div>
        <div className="owner-reviews-count">
          <dt>Đang bị ẩn</dt>
          <dd>{summary.total - summary.visible}</dd>
        </div>
      </dl>
    </Card>
  );
}

function ReviewItem({
  review,
  onReply,
}: {
  review: OwnerReviewSeed;
  onReply: (review: OwnerReviewSeed) => void;
}) {
  const visible = review.moderation === "visible";
  return (
    <li className="owner-review">
      <div className="owner-review-main">
        <Avatar name={review.author} />
        <div className="owner-review-heading">
          <strong>{review.author}</strong>
          <div className="owner-review-meta">
            <span>{relativeTimeLabel(review.date)}</span>
            {review.visitedFrom && <span>· Ghé {dateLabel(review.visitedFrom)}</span>}
            <span>· {review.likes} lượt thích</span>
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
      {visible && <p className="owner-review-text">{review.text}</p>}

      {visible && review.images.length > 0 && (
        <ul className="owner-review-images">
          {review.images.map((image, index) => (
            <li key={image}>
              <img
                className="owner-review-image"
                src={image}
                alt={`Ảnh thực khách ${review.author} đăng kèm, ảnh ${index + 1}`}
              />
            </li>
          ))}
        </ul>
      )}

      {review.reply && (
        <div className="owner-review-reply">
          <div className="owner-review-reply-head">
            <strong>Phản hồi của Bếp Nhà</strong>
            {review.replyPending ? (
              <Badge tone="warning">Đang chờ kiểm duyệt</Badge>
            ) : (
              <Badge tone="success">Đang hiển thị</Badge>
            )}
          </div>
          <p className="owner-review-reply-text">
            {review.reply}
          </p>
          {review.replyPending && (
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
        {!visible && <span className="helper">Chỉ phản hồi đánh giá đang hiển thị.</span>}
      </div>
    </li>
  );
}

export function RestaurantReviewsPage() {
  const [reviews, setReviews] = useState<OwnerReviewSeed[]>(() =>
    structuredClone(ownerReviewsSeed),
  );
  const [filter, setFilter] = useState<ReplyFilter>("all");
  const [stars, setStars] = useState("all");
  const [sort, setSort] = useState<SortValue>("newest");
  const [editing, setEditing] = useState<OwnerReviewSeed | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<OwnerReviewSeed | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  /** Đưa tiêu điểm về ô nhập khi báo lỗi để người dùng sửa ngay. */
  function focusReplyField() {
    document.getElementById(REPLY_FIELD_ID)?.focus();
  }

  const rows = useMemo(() => {
    const filtered = reviews.filter((review) => {
      if (filter === "unanswered" && review.reply) return false;
      if (filter === "answered" && !review.reply) return false;
      if (stars !== "all" && review.rating !== Number(stars)) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => b.date.localeCompare(a.date));
    if (sort === "oldest") sorted.sort((a, b) => a.date.localeCompare(b.date));
    if (sort === "highest") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") sorted.sort((a, b) => a.rating - b.rating);
    return sorted;
  }, [reviews, filter, stars, sort]);

  /** Chỉ cắt trang sau khi lọc và sắp xếp để trang luôn khớp danh sách. */
  const paged = useMemo(
    () => pageSlice(rows, page, PAGE_SIZE),
    [rows, page],
  );

  /**
   * Đổi bộ lọc hoặc sắp xếp thì về lại trang đầu cho khỏi trang trống.
   * `setter` là `useState` setter nên nhận `string` và tự thu hẹp kiểu.
   */
  function changeFilter<T>(setter: (value: T) => void) {
    return (value: string) => {
      setter(value as T);
      setPage(1);
    };
  }

  function openReply(review: OwnerReviewSeed) {
    setEditing(review);
    setText(review.reply ?? "");
    setError("");
    setSaved("");
  }

  function closeReply() {
    setEditing(null);
    setText("");
    setError("");
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const content = text.trim();
    if (!content) {
      setError("Phản hồi không được để trống.");
      focusReplyField();
      return;
    }
    if (content.length > REPLY_MAX) {
      setError(`Phản hồi không vượt quá ${REPLY_MAX} ký tự.`);
      focusReplyField();
      return;
    }
    setBusy(true);
    setReviews((current) =>
      current.map((review) =>
        review.id === editing.id
          ? {
              ...review,
              reply: content,
              // Giao diện chưa nối API nên phản hồi mới được đánh dấu là
              // đang chờ kiểm duyệt, đúng như luồng thật của backend.
              replyPending: review.reply ? false : true,
              replyModeration: "visible",
            }
          : review,
      ),
    );
    const author = editing.author;
    closeReply();
    setBusy(false);
    setSaved(`Đã gửi phản hồi tới ${author}.`);
  }

  function removeReply(review: OwnerReviewSeed) {
    setReviews((current) =>
      current.map((item) =>
        item.id === review.id
          ? {
              ...item,
              reply: undefined,
              replyModeration: undefined,
              replyPending: false,
            }
          : item,
      ),
    );
    setRemoving(null);
    setSaved(`Đã gỡ phản hồi của ${review.author}.`);
  }

  return (
    <div className="stack owner-reviews">
      <PageHeading
        title="Lắng nghe thực khách"
        description="Đọc đánh giá và phản hồi từng trải nghiệm."
      />

      <Alert tone="info">
        Đang xem dữ liệu minh họa. Phản hồi gửi đi chỉ lưu trong phiên này và chưa
        được gửi lên máy chủ.
      </Alert>

      {saved && <Alert tone="success">{saved}</Alert>}

      <RatingSummary reviews={reviews} />

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
          <SelectField
            label="Sắp xếp"
            value={sort}
            onChange={changeFilter((value) => setSort(value as SortValue))}
            options={[
              { value: "newest", label: "Mới nhất" },
              { value: "oldest", label: "Cũ nhất" },
              { value: "highest", label: "Sao cao nhất" },
              { value: "lowest", label: "Sao thấp nhất" },
            ]}
          />
        </div>
      </Card>

      <Card title={`${rows.length} đánh giá`}>
        {rows.length === 0 ? (
          <EmptyState title="Không có đánh giá phù hợp">
            Thử đổi bộ lọc để xem thêm đánh giá của thực khách.
          </EmptyState>
        ) : (
          <ul className="owner-reviews-list">
            {paged.items.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                onReply={openReply}
              />
            ))}
          </ul>
        )}
      </Card>

      {rows.length > PAGE_SIZE && (
        <Pagination
          total={rows.length}
          page={page}
          size={PAGE_SIZE}
          onChange={setPage}
        />
      )}

      <Dialog
        open={!!editing}
        onClose={closeReply}
        title={`Phản hồi ${editing?.author ?? ""}`}
        footer={
          <>
            {editing?.reply && (
              <Button
                variant="destructive"
                onClick={() => setRemoving(editing)}
              >
                Gỡ phản hồi
              </Button>
            )}
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
              if (error) setError("");
            }}
            error={error}
            helper="Cảm ơn thực khách và cho biết bước tiếp theo bạn sẽ làm."
            maxLength={REPLY_MAX}
            rows={6}
            required
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!removing}
        title="Gỡ phản hồi này?"
        label="Gỡ phản hồi"
        cancelLabel="Giữ phản hồi"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removeReply(removing)}
      >
        <p>
          Phản hồi của Bếp Nhà cho {removing?.author ?? ""} sẽ bị gỡ khỏi đánh
          giá này. Thực khách sẽ không còn thấy phản hồi của nhà hàng.
        </p>
      </ConfirmDialog>
    </div>
  );
}