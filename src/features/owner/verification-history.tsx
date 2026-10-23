"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Dialog,
  EmptyState,
  Skeleton,
} from "@/components/ui/primitives";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { ownerRoutes } from "./routes";
import { verificationLabels } from "./status-labels";
import {
  VerificationDetails,
  verificationDateLabel,
} from "./verification-details";
import {
  resubmittableVerification,
  verificationStatusLabels,
} from "./verification-rules";
import type { VerificationService } from "./verification-service";
import type {
  GetVerificationStatusResponseDto,
  VerificationDto,
} from "./verification-types";

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing"; message: string }
  | { status: "ready"; data: GetVerificationStatusResponseDto };

export function VerificationHistory({
  service,
  onLoaded,
  onPrepare,
  onResubmit,
}: {
  service: Pick<VerificationService, "getHistory">;
  onLoaded: (result: GetVerificationStatusResponseDto) => void;
  onPrepare: () => void;
  onResubmit: (previous: VerificationDto) => void;
}) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    service
      .getHistory()
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", data });
        onLoaded(data);
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status:
            error instanceof ApiError &&
            error.errorCode === "RESTAURANT_NOT_FOUND"
              ? "missing"
              : "error",
          message: getErrorMessage(error),
        });
      });
    return () => {
      active = false;
    };
  }, [service, attempt, onLoaded]);
  function reload() {
    setState({ status: "loading" });
    setSelectedId(null);
    setAttempt((value) => value + 1);
  }
  if (state.status === "loading") return <Skeleton />;
  if (state.status === "missing")
    return (
      <EmptyState
        title="Bạn chưa đăng ký nhà hàng"
        action={
          <ActionLink href={ownerRoutes.register}>Đăng ký nhà hàng</ActionLink>
        }
      >
        Đăng ký nhà hàng trước khi xem hồ sơ xác minh.
      </EmptyState>
    );
  if (state.status === "error")
    return (
      <Card title="Chưa tải được lịch sử xác minh">
        <Alert>{state.message}</Alert>
        <Button onClick={reload}>Thử lại lịch sử</Button>
      </Card>
    );
  const { items, verificationStatus } = state.data;
  const latest = items[0];
  const resubmittable = resubmittableVerification({
    verificationStatus,
    latestVerification: latest ?? null,
  });
  const selected = items.find((item) => item.id === selectedId);
  return (
    <div className="stack verification-history">
      <div className="between verification-summary">
        <p>
          Trạng thái xác minh nhà hàng:{" "}
          <Badge>{verificationLabels[verificationStatus]}</Badge>
        </p>
        <Button variant="secondary" onClick={reload}>
          Tải lại lịch sử
        </Button>
      </div>
      <Card title="Hồ sơ gần nhất">
        {latest ? (
          <VerificationDetails verification={latest} />
        ) : (
          <EmptyState title="Chưa có hồ sơ xác minh">
            Nhà hàng chưa có hồ sơ trong lịch sử.
          </EmptyState>
        )}
        {verificationStatus === "pending" && (
          <Alert tone="info">
            Hồ sơ đang chờ duyệt. Bạn có thể tải lại để xem phản hồi mới.
          </Alert>
        )}
        {verificationStatus === "verified" && (
          <Alert tone="success">Nhà hàng đã được xác minh.</Alert>
        )}
        {verificationStatus === "rejected" && (
          <Alert tone="warning">
            Xem phản hồi của người duyệt để biết nội dung cần chỉnh sửa hoặc bổ
            sung.
          </Alert>
        )}
        {resubmittable && (
          <Button onClick={() => onResubmit(resubmittable)}>
            Gửi lại hồ sơ
          </Button>
        )}
        {verificationStatus === "unverified" && (
          <Button onClick={onPrepare}>Chuẩn bị hồ sơ</Button>
        )}
      </Card>
      {!!items.length && (
        <Card title="Lịch sử hồ sơ">
          <p className="helper">{items.length} hồ sơ · Mới nhất trước</p>
          <ol className="verification-history-list">
            {items.map((item, index) => (
              <li key={item.id} className="verification-history-item">
                <div>
                  <strong>
                    Hồ sơ #{item.id}
                    {index === 0 ? " · Mới nhất" : ""}
                  </strong>
                  <p>Ngày gửi: {verificationDateLabel(item.submittedAt)}</p>
                  <Badge>{verificationStatusLabels[item.status]}</Badge>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedId(item.id)}
                >
                  Xem hồ sơ #{item.id}
                </Button>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <Dialog
        open={!!selected}
        title={selected ? `Chi tiết hồ sơ #${selected.id}` : "Chi tiết hồ sơ"}
        onClose={() => setSelectedId(null)}
        wide
      >
        {selected && (
          <>
            <VerificationDetails verification={selected} />
            {selected.previousId !== null &&
              items.some((item) => item.id === selected.previousId) && (
                <Button
                  variant="secondary"
                  onClick={() => setSelectedId(selected.previousId)}
                >
                  Xem hồ sơ trước #{selected.previousId}
                </Button>
              )}
          </>
        )}
      </Dialog>
    </div>
  );
}
