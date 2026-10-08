import RoleDashboard from "@/components/role-dashboard";
import { requireUser } from "@/features/auth/server";
export default async function RestaurantPage() {
  return (
    <RoleDashboard
      user={await requireUser(["RESTAURANT_OWNER"])}
      title="Không gian nhà hàng"
      description="Chăm chút thông tin nhà hàng và giới thiệu những món ngon của bạn."
      features={["Hồ sơ nhà hàng", "Thực đơn", "Đánh giá"]}
    />
  );
}
