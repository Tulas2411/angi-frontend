"use client";
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui";
import {
  Dialog,
  TextArea,
  UploadField,
  type UploadedFile,
} from "@/components/ui/primitives";

/** Nhãn mô tả mức độ hài lòng đi kèm số sao đang chọn. */
const RATING_LABELS: Record<number, string> = {
  1: "Rất tệ",
  2: "Tệ",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Tuyệt vời",
};
const RATING_VALUES = [1, 2, 3, 4, 5] as const;
const REVIEW_TEXT_MAX = 2000;
const REVIEW_PHOTOS_MAX = 5;
const REVIEW_FORM_ID = "write-review-form";

/**
 * Popup viết đánh giá ở trang chi tiết nhà hàng.
 * Bố cục: mô tả → chọn số sao → nội dung → ảnh thực tế.
 */
export function WriteReviewDialog({
  open,
  onClose,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  onSubmit: (payload: {
    rating: number;
    text: string;
    photos: UploadedFile[];
  }) => Promise<void> | void;
}) {
  const [rating, setRating] = useState(5),
    [text, setText] = useState(""),
    [photos, setPhotos] = useState<UploadedFile[]>([]);

  // Mỗi lần mở lại popup thì bắt đầu với phiếu đánh giá trống.
  useEffect(() => {
    if (!open) return;
    setRating(5);
    setText("");
    setPhotos([]);
  }, [open]);

  function close() {
    setRating(5);
    setText("");
    setPhotos([]);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Viết đánh giá"
      footer={
        <div className="dialog-actions-review">
          <Button type="submit" form={REVIEW_FORM_ID} loading={busy}>
            Gửi đánh giá
          </Button>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Hủy
          </Button>
        </div>
      }
    >
      <form
        id={REVIEW_FORM_ID}
        className="write-review"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit({ rating, text: text.trim(), photos });
          close();
        }}
      >
        <p className="write-review-lead">
          Chia sẻ trải nghiệm của bạn tại quán. Mỗi người khám phá chỉ được
          đánh giá một lần cho mỗi nhà hàng.
        </p>
        <div className="field">
          <span className="write-review-label" id="write-review-rating-label">
            Đánh giá nhà hàng *
          </span>
          <div
            className="write-review-stars"
            role="radiogroup"
            aria-labelledby="write-review-rating-label"
          >
            {RATING_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} sao · ${RATING_LABELS[value]}`}
                className={`write-review-star ${
                  rating === value ? "is-selected" : ""
                }`}
                onClick={() => setRating(value)}
                suppressHydrationWarning
              >
                <svg
                  className="write-review-star-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden
                  focusable="false"
                >
                  <path
                    d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.05-5.8 3.05 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"
                    fill="currentColor"
                  />
                </svg>
                <span>{value}</span>
              </button>
            ))}
          </div>
          <p className="helper write-review-stars-caption">
            {rating} / 5 · {RATING_LABELS[rating]}
          </p>
        </div>
        <TextArea
          label="Nội dung đánh giá"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Cà phê trưng bày nhẹ, không gian nhỏ và gần Hồ Gươm. Mình sẽ ghé lại."
          maxLength={REVIEW_TEXT_MAX}
          required
        />
        <div className="write-review-photos">
          <UploadField
            label="Ảnh thực tế nghiệm · Không bắt buộc"
            helper="JPG, PNG hoặc WEBP · Tối đa 5 ảnh · Mỗi ảnh không quá 5 MB"
            showCount={false}
            files={photos}
            max={REVIEW_PHOTOS_MAX}
            onChange={setPhotos}
          />
        </div>
      </form>
    </Dialog>
  );
}