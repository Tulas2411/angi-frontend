"use client";
import { Alert, Button, Card } from "@/shared/ui";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Card title="Chưa thể tải trang">
      <Alert>Vui lòng thử lại sau một chút.</Alert>
      <div className="actions">
        <Button onClick={reset}>Thử lại</Button>
      </div>
    </Card>
  );
}
