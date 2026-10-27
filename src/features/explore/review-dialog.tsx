"use client";
import { useRef, useState } from "react";
import { Alert, Button } from "@/shared/ui";
import { Dialog, TextArea } from "@/components/ui/primitives";
import {
  ImageAttachments,
  type Attachment,
} from "@/components/domain/image-attachments";
import {
  maxReviewImages,
  maxReviewLength,
  reviewError,
  reviewProblems,
} from "./explore-rules";
import type { ExploreService } from "./explore-service";
import type { ReviewDto } from "./explore-types";

const starLabels = ["Rất tệ", "Tệ", "Bình thường", "Ngon", "Rất ngon"];

/** REV-01: a Traveler reviews a restaurant once, with a star rating, a text and up to five photos. */
export function ReviewDialog({
  restaurantId,
  restaurantName,
  service,
  open,
  onClose,
  onSaved,
}: {
  restaurantId: number;
  restaurantName: string;
  service: Pick<ExploreService, "createReview" | "upload">;
  open: boolean;
  onClose: () => void;
  /** The review exists now (also when it already did): the page reads the restaurant again. */
  onSaved: (review: ReviewDto | null) => void;
}) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<{
    rating?: string;
    content?: string;
  }>({});
  const [failure, setFailure] = useState("");
  const sending = useRef(false);

  function close() {
    if (sending.current || uploading) return;
    onClose();
  }

  async function submit() {
    if (sending.current || uploading) return;
    const found = reviewProblems(rating, content);
    setProblems(found);
    setFailure("");
    if (found.rating || found.content) return;
    sending.current = true;
    setBusy(true);
    try {
      const saved = await service.createReview(restaurantId, {
        rating,
        content: content.trim() || undefined,
        imageMediaIds: images.length
          ? images.map((image) => image.mediaId)
          : undefined,
      });
      onSaved(saved);
    } catch (caught) {
      const result = reviewError(caught);
      if (result.settled) onSaved(null);
      else setFailure(result.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Đánh giá ${restaurantName}`}
      focusField
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Để sau
          </Button>
          <Button
            onClick={() => void submit()}
            loading={busy}
            disabled={uploading}
          >
            Gửi đánh giá
          </Button>
        </>
      }
    >
      <form
        className="stack-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <fieldset className="explore-stars">
          <legend>Bạn thấy quán thế nào?</legend>
          <div
            role="radiogroup"
            aria-label="Số sao"
            className="explore-star-row"
          >
            {starLabels.map((label, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} sao: ${label}`}
                  className={`explore-star ${value <= rating ? "on" : ""}`}
                  onClick={() => setRating(value)}
                  suppressHydrationWarning
                >
                  <span aria-hidden>★</span>
                </button>
              );
            })}
            <span className="helper" aria-live="polite">
              {rating ? starLabels[rating - 1] : "Chưa chọn"}
            </span>
          </div>
          {problems.rating && (
            <p role="alert" className="field-error">
              {problems.rating}
            </p>
          )}
        </fieldset>
        <TextArea
          label="Cảm nhận của bạn"
          value={content}
          maxLength={maxReviewLength}
          onChange={(event) => setContent(event.target.value)}
          helper="Nói về món, giá và không gian của quán (không bắt buộc)."
          error={problems.content}
        />
        <ImageAttachments
          label="Ảnh món ăn"
          helper="Tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh dưới 5 MB."
          max={maxReviewImages}
          value={images}
          onChange={setImages}
          onUploading={setUploading}
          upload={(file) => service.upload(file, "review")}
        />
        {failure && <Alert>{failure}</Alert>}
      </form>
    </Dialog>
  );
}
