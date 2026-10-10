import { notFound } from "next/navigation";
import Brand from "@/components/brand";
import { ActionLink } from "@/components/ui/primitives";
import { Card, Alert } from "@/shared/ui";
export default function DemoPortal() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO === "false") notFound();
  return (
    <main className="container workspace stack">
      <Brand />
      <h1>Khám phá ANGI</h1>
      <Alert tone="info">
        Bản minh họa sử dụng dữ liệu mẫu trong bộ nhớ. Không tạo phiên đăng
        nhập, gửi email hoặc thay đổi dữ liệu thật.
      </Alert>
      <div className="grid-3">
        {[
          ["guest", "Khách khám phá"],
          ["traveler", "Người khám phá"],
          ["owner", "Chủ nhà hàng"],
          ["moderator", "Kiểm duyệt viên"],
          ["admin", "Quản trị viên"],
        ].map(([role, label]) => (
          <Card key={role} title={label}>
            <p>Trải nghiệm màn hình và thao tác với dữ liệu minh họa.</p>
            <ActionLink href={`/demo/${role}`}>Mở không gian</ActionLink>
          </Card>
        ))}
      </div>
      <div className="actions">
        <ActionLink href="/dev/components" secondary>
          Thư viện thành phần
        </ActionLink>
        <ActionLink href="/login" secondary>
          Đăng nhập tài khoản thật
        </ActionLink>
      </div>
    </main>
  );
}
