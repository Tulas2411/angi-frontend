import type { AuthUserDto } from "@/features/auth/types";
import SessionPanel from "@/features/auth/session-panel";
import { Badge, Card } from "@/shared/ui";

export default function RoleDashboard({
  user,
  title,
  description,
  features,
}: {
  user: AuthUserDto;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
          Không gian của bạn
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
          {description}
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Chào mừng đến với ANGI">
          <p className="mb-6 text-sm leading-7 text-stone-600">
            Chào {user.displayName}, khu vực của bạn đã sẵn sàng. Các chức năng
            dưới đây đang được phát triển.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {features.map((feature) => (
              <Badge key={feature}>{feature}</Badge>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-5 py-10 text-center">
            <p className="font-semibold">Sắp có những trải nghiệm mới</p>
            <p className="mt-2 text-sm text-stone-500">
              Nội dung sẽ xuất hiện khi các chức năng được mở.
            </p>
          </div>
        </Card>
        <Card title="Thông tin tài khoản">
          <SessionPanel expectedRole={user.role} />
        </Card>
      </div>
    </div>
  );
}
