"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  EmptyState,
  Pagination,
  SelectField,
  Skeleton,
} from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
import { useRemote } from "@/features/explore/use-remote";
import {
  count,
  dashboardError,
  dateTime,
  eventTypeLabels,
  outboxStatusLabels,
} from "./dashboard-rules";
import { dashboardService, type DashboardService } from "./dashboard-service";
import type { OutboxQuery } from "./dashboard-types";
import { SlidingSegment } from "@/components/ui/sliding-segment";
import "./dashboard.css";

const statusChoices: {
  value: NonNullable<OutboxQuery["status"]>;
  label: string;
}[] = [
  { value: "dead", label: "Gửi thất bại" },
  { value: "pending", label: "Đang chờ gửi" },
  { value: "processing", label: "Đang gửi" },
];
const eventChoices = [
  { value: "", label: "Mọi loại sự kiện" },
  { value: "DISH_UPSERTED", label: "Cập nhật món" },
  { value: "DISH_DEACTIVATED", label: "Ngừng bán món" },
  { value: "FEEDBACK_CREATED", label: "Đánh giá món" },
];
const statusTone = (status: string) =>
  status === "dead" ? "error" : status === "pending" ? "warning" : "neutral";

/** OPS-01 (outside the use cases, for operations): the outbox events, failed ones first. */
export function OutboxPage({
  service = dashboardService,
}: {
  service?: DashboardService;
}) {
  const [status, setStatus] =
    useState<NonNullable<OutboxQuery["status"]>>("dead");
  const [eventType, setEventType] = useState<OutboxQuery["eventType"] | "">("");
  const [page, setPage] = useState(1);
  const [state, retry] = useRemote(
    () =>
      service.outbox({
        status,
        eventType: eventType || undefined,
        page,
        pageSize: 20,
      }),
    `${status}:${eventType}:${page}`,
  );

  return (
    <div className="stack dash-page">
      <PageHeading
        title="Đồng bộ dữ liệu gợi ý"
        description="Các sự kiện ANGI gửi sang dịch vụ gợi ý món. Sự kiện gửi xong không còn ở đây; sự kiện thất bại cần được kiểm tra."
      />
      <div className="dash-outbox-filters">
        <SlidingSegment
          className="dash-segmented"
          role="group"
          aria-label="Trạng thái"
        >
          {statusChoices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={status === choice.value}
              onClick={() => {
                setStatus(choice.value);
                setPage(1);
              }}
            >
              {choice.label}
            </button>
          ))}
        </SlidingSegment>
        <SelectField
          label="Loại sự kiện"
          value={eventType}
          options={eventChoices}
          onChange={(value) => {
            setEventType(value as OutboxQuery["eventType"] | "");
            setPage(1);
          }}
        />
      </div>
      {state.status === "loading" && <Skeleton rows={5} />}
      {state.status === "error" && (
        <Card title="Chưa tải được danh sách sự kiện">
          <Alert>{dashboardError(state.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {state.status === "ready" &&
        (state.data.items.length === 0 ? (
          <EmptyState title="Không có sự kiện nào">
            {status === "dead"
              ? "Mọi sự kiện đều đã gửi được sang dịch vụ gợi ý."
              : "Không có sự kiện nào ở trạng thái này."}
          </EmptyState>
        ) : (
          <section className="stack-sm" aria-label="Sự kiện outbox">
            <p className="helper" role="status">
              {count(state.data.totalItems)} sự kiện
            </p>
            <ul className="dash-outbox-rows">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <details>
                    <summary>
                      <Badge tone={statusTone(item.status)}>
                        {outboxStatusLabels[item.status] ?? item.status}
                      </Badge>
                      <span className="dash-outbox-main">
                        <strong>
                          {eventTypeLabels[item.eventType] ?? item.eventType}
                        </strong>
                        <small>
                          {item.aggregateKey} · tạo {dateTime(item.createdAt)}
                        </small>
                      </span>
                      <span className="dash-outbox-meta">
                        <span>{item.attemptCount} lần thử</span>
                        <small>
                          {item.nextAttemptAt
                            ? `Thử lại ${dateTime(item.nextAttemptAt)}`
                            : "Không tự thử lại"}
                        </small>
                      </span>
                    </summary>
                    <div className="dash-outbox-detail">
                      {item.lastError && (
                        <p>
                          <strong>Lỗi lần gửi cuối:</strong>{" "}
                          <code>{item.lastError}</code>
                        </p>
                      )}
                      <p className="helper">Mã sự kiện: {item.eventUuid}</p>
                      <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            {state.data.totalPages > 1 && (
              <Pagination
                total={state.data.totalItems}
                page={state.data.page}
                size={state.data.pageSize}
                onChange={setPage}
              />
            )}
          </section>
        ))}
    </div>
  );
}
