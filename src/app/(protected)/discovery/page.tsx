import RoleDashboard from "@/components/role-dashboard";
import { requireUser } from "@/features/auth/server";
export default async function DiscoveryPage() {
  return (
    <RoleDashboard
      user={await requireUser(["TRAVELER"])}
      title="Khám phá hương vị"
      description="Những món ngon, nhà hàng và hành trình dành cho khẩu vị của bạn."
      features={["Khám phá món ăn", "Lộ trình ẩm thực", "Cộng đồng"]}
    />
  );
}
