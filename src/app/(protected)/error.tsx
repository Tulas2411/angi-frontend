"use client";
import { Button, Card } from "@/shared/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Card title="Chưa thể tải trang">
      <p className="mb-5 text-sm text-stone-500">
        Vui lòng thử lại sau một chút.
      </p>
      <Button onClick={reset}>Thử lại</Button>
    </Card>
  );
}
