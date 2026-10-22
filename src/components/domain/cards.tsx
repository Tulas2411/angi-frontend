"use client";
import type { ReactNode } from "react";
import { Badge, Card } from "@/shared/ui";
import { ActionLink, Avatar, Media } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/layout/workspace";
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
        <span>
          {
            {
              open: "Đang mở",
              closed: "Đang đóng",
              temporarily_closed: "Tạm đóng",
              permanently_closed: "Đóng cửa vĩnh viễn",
            }[restaurant.operating]
          }
        </span>
      </div>
      <div>
        <h3>Kiểm duyệt</h3>
        <span>{visibilityLabels[restaurant.moderation]}</span>
      </div>
    </div>
  );
}
export function DishCard({
  dish,
  href,
  isDetailPage = false,
}: {
  dish: Dish;
  href: string;
  isDetailPage?: boolean;
}) {
  // `base` giữ đúng tiền tố của không gian hiện tại (rỗng ở live, /demo/xxx ở demo)
  // để nút "Xem chi tiết" không bật ra khỏi workspace.
  const { base } = useWorkspace();
  return (
    <Card className="domain-card">
      <Media src={dish.image} alt={dish.name} />
      <h3>{dish.name}</h3>
      <p className="helper">
        {dish.tags.join(" · ")} · {money(dish.price)}
      </p>
      <div className="actions">
        {isDetailPage ? (
          <ActionLink href={`${base}/dishes/${dish.id}`} secondary>
            Xem chi tiết
          </ActionLink>
        ) : (
          <ActionLink href={href} secondary>
            Xem quán
          </ActionLink>
        )}
      </div>
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
        {restaurant.ward || restaurant.district || restaurant.province} ·{" "}
        {restaurant.rating} / 5 · {verificationLabels[restaurant.verification]}
      </p>
      <ActionLink href={href} secondary>
        Xem chi tiết
      </ActionLink>
    </Card>
  );
}
export function BlogCard({
  blog,
  href,
  actions,
}: {
  blog: Blog;
  href: string;
  /** Nút hành động nổi trên ảnh (chỉ dùng ở trang "bài viết của tôi"). */
  actions?: ReactNode;
}) {
  return (
    <Card className="domain-card blog-card">
      <div className="blog-card-media">
        <Media src={blog.image} alt={blog.title} />
        {actions && (
          <div className="blog-card-overlay">{actions}</div>
        )}
      </div>
      <div className="blog-card-body">
        <h3 className="blog-card-title">{blog.title}</h3>
        <p className="blog-card-excerpt">{blog.content.split("\n")[0]}</p>
        <div className="blog-card-footer">
          <div className="blog-card-author">
            <Avatar name={blog.author} className="blog-card-avatar" />
            <div className="blog-card-author-meta">
              <span className="blog-card-author-name">{blog.author}</span>
              <span className="blog-card-date">{dateLabel(blog.date)}</span>
            </div>
          </div>
          <div className="blog-card-stats">
            <span className="blog-card-stat">
              ♥ {blog.likes}
            </span>
            <span className="blog-card-stat">
              💬 {blog.comments.filter((c) => c.moderation === "visible").length}
            </span>
          </div>
        </div>
      </div>
      <ActionLink href={href} secondary className="blog-card-link">
        Đọc cẩm nang
      </ActionLink>
    </Card>
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
