import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/features/auth/server";
import { NotificationsPage } from "@/features/notifications/notifications-page";

export const metadata: Metadata = { title: "Thông báo" };

export default async function Page() {
  // NOTI-01..03 belong to every signed-in role.
  const user = await requireUser();
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <NotificationsPage role={user.role} />
    </Suspense>
  );
}
