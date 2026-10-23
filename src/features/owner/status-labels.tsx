import { Badge } from "@/shared/ui";
import { operatingStatusLabels } from "./operating-status-rules";
import type { OwnerRestaurantDto } from "./restaurant-types";

/** Vietnamese labels for the three independent restaurant states returned by OWN-02. */
export const verificationLabels: Record<
  OwnerRestaurantDto["verificationStatus"],
  string
> = {
  verified: "Đã xác minh",
  pending: "Chờ xác minh",
  unverified: "Chưa xác minh",
  rejected: "Bị từ chối",
};

export const moderationLabels: Record<
  OwnerRestaurantDto["moderationStatus"],
  string
> = {
  visible: "Hiển thị",
  hidden: "Bị ẩn",
  suspended: "Bị đình chỉ",
};

const verificationTone = {
  verified: "success",
  pending: "warning",
  unverified: "neutral",
  rejected: "error",
} as const;

const moderationTone = {
  visible: "success",
  hidden: "warning",
  suspended: "error",
} as const;

const operatingTone = {
  open: "success",
  temporarily_closed: "warning",
  permanently_closed: "error",
} as const;

/** Verification, operating and moderation states stay visibly separate. */
export function RestaurantStatusGrid({
  restaurant,
}: {
  restaurant: Pick<
    OwnerRestaurantDto,
    "verificationStatus" | "operatingStatus" | "moderationStatus"
  >;
}) {
  return (
    <div className="status-grid">
      <div>
        <h3>Xác minh nhà hàng</h3>
        <Badge tone={verificationTone[restaurant.verificationStatus]}>
          {verificationLabels[restaurant.verificationStatus]}
        </Badge>
      </div>
      <div>
        <h3>Hoạt động</h3>
        <Badge tone={operatingTone[restaurant.operatingStatus]}>
          {operatingStatusLabels[restaurant.operatingStatus]}
        </Badge>
      </div>
      <div>
        <h3>Kiểm duyệt</h3>
        <Badge tone={moderationTone[restaurant.moderationStatus]}>
          {moderationLabels[restaurant.moderationStatus]}
        </Badge>
      </div>
    </div>
  );
}
