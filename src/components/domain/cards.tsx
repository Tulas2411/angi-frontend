"use client";
import { Badge, Card } from "@/shared/ui";
import { ActionLink, Avatar, Media } from "@/components/ui/primitives";
import type {
  Blog,
  Dish,
  Restaurant,
  Review,
} from "@/features/platform/contracts";
import { dateLabel, money } from "@/features/platform/rules";

export const visibilityLabels = {
  visible: "Hiển thị",
  hidden: "Bị ẩn",
  suspended: "Bị đình chỉ",
};
export const verificationLabels = {
  verified: "Đã xác minh",
  pending: "Chờ xác minh",
  unverified: "Chưa xác minh",
  rejected: "Bị từ chối",
  needs_changes: "Cần bổ sung",
};
export const submissionLabels = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  approved: "Đã phê duyệt",
  rejected: "Bị từ chối",
  needs_changes: "Cần bổ sung",
  cancelled: "Đã hủy",
};
export function RestaurantStatuses({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="status-grid">
      <div>
        <h3>Xác minh nhà hàng</h3>
        <span>{verificationLabels[restaurant.verification]}</span>
      </div>
      <div>
        <h3>Hoạt động</h3>
        <span>{restaurant.operating === "open" ? "Đang mở" : "Đang đóng"}</span>
      </div>
      <div>
        <h3>Kiểm duyệt</h3>
        <span>{visibilityLabels[restaurant.moderation]}</span>
      </div>
    </div>
  );
}
export function DishCard({ dish, href }: { dish: Dish; href: string }) {
  return (
    <Card className="domain-card">
      <Media src={dish.image} alt={dish.name} />
      <h3>{dish.name}</h3>
      <p className="helper">
        {dish.tags.join(" · ")} · {money(dish.price)}
      </p>
      <ActionLink href={href} secondary>
        Xem quán
      </ActionLink>
    </Card>
  );
}
export function RestaurantCard({
  restaurant,
  href,
}: {
  restaurant: Restaurant;
  href: string;
}) {
  return (
    <Card className="domain-card">
      <Media src={restaurant.image} alt={restaurant.name} />
      <h3>{restaurant.name}</h3>
      <p className="helper">
        {restaurant.district} · {restaurant.rating} / 5 ·{" "}
        {verificationLabels[restaurant.verification]}
      </p>
      <ActionLink href={href} secondary>
        Xem chi tiết
      </ActionLink>
    </Card>
  );
}
export function BlogCard({ blog, href }: { blog: Blog; href: string }) {
  return (
    <div className="stack-sm">
      <Card className="domain-card">
        <Media src={blog.image} alt={blog.title} />
        <h3>{blog.title}</h3>
        <p>{blog.content.split("\n")[0]}</p>
        <ActionLink href={href} secondary>
          Đọc cẩm nang
        </ActionLink>
      </Card>
      <p className="helper">
        {blog.author} · {dateLabel(blog.date)}
        <br />
        {blog.likes} lượt thích ·{" "}
        {blog.comments.filter((c) => c.moderation === "visible").length} bình
        luận{blog.trip && " · Có lịch ăn"}
      </p>
    </div>
  );
}
export function ReviewContent({
  review,
  showHidden = false,
}: {
  review: Review;
  showHidden?: boolean;
}) {
  return (
    <>
      <div className="review-header">
        <Avatar name={review.author} />
        <div>
          <strong>{review.author}</strong>
          <p className="helper">{dateLabel(review.date)}</p>
        </div>
        <Badge>{review.rating} / 5 sao</Badge>
        <Badge>{visibilityLabels[review.moderation]}</Badge>
      </div>
      <p>
        {review.moderation === "visible" || showHidden
          ? review.text
          : "Nội dung đánh giá bị ẩn."}
      </p>
      {review.reply && (
        <div className="review-reply">
          <strong>Phản hồi của Bếp Nhà</strong>
          <p>
            {review.replyModeration === "hidden" && !showHidden
              ? "Phản hồi bị ẩn."
              : review.reply}
          </p>
        </div>
      )}
    </>
  );
}
