import RoleDashboard from "@/components/role-dashboard";
import { requireUser } from "@/features/auth/server";
export default async function ModerationPage() {
  return (
    <RoleDashboard
      user={await requireUser(["MOD", "ADMIN"])}
      title="Kiểm duyệt nội dung"
      description="Cùng giữ cho cộng đồng ANGI hữu ích, an toàn và đáng tin cậy."
      features={["Nội dung cần duyệt", "Báo cáo", "Xử lý vi phạm"]}
    />
  );
}
