import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace";
import { readPublicSession } from "@/features/auth/server";

/**
 * Layout của các trang công khai (`/dishes/*`, `/restaurants/*`, `/guides/*`).
 *
 * Đọc user từ session (không chuyển hướng khi chưa đăng nhập) để:
 *  - người đã đăng nhập vẫn thấy avatar + menu tài khoản trên header;
 *  - các nút "bắt buộc đăng nhập" (báo cáo, đánh giá, thích…) hiện đúng trạng thái;
 *  - khách chưa đăng nhập vẫn xem bình thường, KHÔNG bị đẩy về /login.
 */
export default async function ExploreLayout({ children }: { children: ReactNode }) {
  const { user } = await readPublicSession();
  return (
    <WorkspaceShell
      user={user}
      base=""
      mode={process.env.NEXT_PUBLIC_DATA_MODE === "demo" ? "demo" : "live"}
    >
      {children}
    </WorkspaceShell>
  );
}
