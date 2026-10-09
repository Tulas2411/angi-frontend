import RoleDashboard from "@/components/role-dashboard";
import { requireUser } from "@/features/auth/server";
export default async function AdministrationPage() {
  return (
    <RoleDashboard
      user={await requireUser(["ADMIN"])}
      title="Quản trị ANGI"
      description="Không gian quản trị người dùng, phân quyền và hoạt động hệ thống."
      features={["Người dùng", "Phân quyền", "Nhật ký hệ thống"]}
    />
  );
}
