"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowPathIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  HandThumbUpIcon,
  MapIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import { SelectField, Skeleton } from "@/components/ui/primitives";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { useRemote } from "@/features/explore/use-remote";
import { BarList, TrendChart } from "./dashboard-chart";
import {
  breakdownRows,
  bucketLabel,
  count,
  dashboardError,
  dateTime,
  defaultInterval,
  eventTypeLabels,
  intervalAllowed,
  intervalOptions,
  metricOptions,
  moderationLabels,
  outboxStatusLabels,
  percent,
  rangeLabel,
  rangeOf,
  rangePresets,
  roleLabels,
  topScore,
  userStatusLabels,
  verificationLabels,
} from "./dashboard-rules";
import {
  dashboardService,
  type DashboardService,
  type DateRange,
} from "./dashboard-service";
import type {
  DashboardInterval,
  DashboardMetric,
  DashboardSummaryDto,
  DashboardTopType,
} from "./dashboard-types";
import "./dashboard.css";

const topTabs: { value: DashboardTopType; label: string }[] = [
  { value: "dishes", label: "Món ăn" },
  { value: "restaurants", label: "Nhà hàng" },
  { value: "blogs", label: "Bài cẩm nang" },
];

function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="dash-failed" role="alert">
      <p>{dashboardError(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

/** A small segmented choice (range presets, intervals, top tabs). */
function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: (value: T) => boolean;
}) {
  return (
    <div className="dash-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled?.(option.value)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** ADM-D1: headline numbers of the range, then the work waiting for moderators. */
function Summary({
  data,
  moderation,
}: {
  data: DashboardSummaryDto;
  moderation: string;
}) {
  const tiles = [
    {
      icon: UsersIcon,
      label: "Người dùng",
      value: data.users.total,
      note: `+${count(data.users.new)} mới trong kỳ`,
    },
    {
      icon: BuildingStorefrontIcon,
      label: "Nhà hàng",
      value: data.restaurants.total,
      note: `+${count(data.restaurants.new)} mới trong kỳ`,
    },
    {
      icon: MapIcon,
      label: "Lộ trình tạo trong kỳ",
      value: data.roadmaps.created,
      note: `${count(data.roadmaps.aiGenerationJobs)} lần nhờ AI lên lịch`,
    },
    {
      icon: ChatBubbleLeftRightIcon,
      label: "Bài cẩm nang trong kỳ",
      value: data.content.blogs,
      note: `${count(data.content.comments)} bình luận · ${count(data.content.reviews)} đánh giá quán`,
    },
    {
      icon: HandThumbUpIcon,
      label: "Lượt thích món trong kỳ",
      value: data.feedback.likes,
      note: `${percent(data.feedback.likes, data.feedback.likes + data.feedback.dislikes)} tích cực · ${count(data.feedback.dislikes)} không thích`,
    },
  ];
  const queues = [
    {
      icon: CheckBadgeIcon,
      label: "Hồ sơ xác minh chờ duyệt",
      value: data.queues.pendingVerifications,
      href: `${moderation}/verification`,
    },
    {
      icon: BookOpenIcon,
      label: "Thực đơn chờ duyệt",
      value: data.queues.pendingMenus,
      href: `${moderation}/menus`,
    },
    {
      icon: FlagIcon,
      label: "Báo cáo nhà hàng chờ xử lý",
      value: data.queues.pendingRestaurantReports,
      href: `${moderation}/reports`,
    },
    {
      icon: ChatBubbleLeftRightIcon,
      label: "Báo cáo cộng đồng chờ xử lý",
      value: data.queues.pendingSocialReports,
      href: `${moderation}/reports`,
    },
  ];
  return (
    <>
      <section className="dash-kpis" aria-label="Chỉ số tổng quan">
        {tiles.map((tile) => (
          <div key={tile.label} className="dash-kpi">
            <tile.icon aria-hidden />
            <span>{tile.label}</span>
            <strong>{count(tile.value)}</strong>
            <small>{tile.note}</small>
          </div>
        ))}
      </section>
      <section className="dash-queues" aria-labelledby="dash-queues-title">
        <h2 id="dash-queues-title">Việc đang chờ xử lý</h2>
        <ul>
          {queues.map((queue) => (
            <li key={queue.label}>
              <Link href={queue.href} data-waiting={queue.value > 0}>
                <queue.icon aria-hidden />
                <span>
                  <strong>{count(queue.value)}</strong>
                  {queue.label}
                </span>
                <ArrowRightIcon aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** ADM-D2 with its metric and bucket; a table view beside the chart. */
function Trend({
  service,
  range,
}: {
  service: DashboardService;
  range: DateRange;
}) {
  const [metric, setMetric] = useState<DashboardMetric>("new_users");
  const [chosen, setChosen] = useState<DashboardInterval | null>(null);
  const [table, setTable] = useState(false);
  const interval =
    chosen && intervalAllowed(chosen, range) ? chosen : defaultInterval(range);
  const [state, retry] = useRemote(
    () => service.timeseries(metric, range, interval),
    `${metric}:${range.from}:${range.to}:${interval}`,
  );
  const label =
    metricOptions.find((item) => item.value === metric)?.label ?? metric;
  const total =
    state.status === "ready"
      ? state.data.points.reduce((sum, point) => sum + point.value, 0)
      : 0;
  return (
    <Card>
      <div className="dash-card-head">
        <div>
          <h2>{label}</h2>
          <p className="helper">
            {state.status === "ready"
              ? `Tổng ${count(total)} trong ${rangeLabel(range)}`
              : rangeLabel(range)}
          </p>
        </div>
        <div className="dash-controls">
          <SelectField
            label="Chỉ số"
            value={metric}
            options={metricOptions}
            onChange={(value) => setMetric(value as DashboardMetric)}
          />
          <Segmented
            label="Gom theo"
            value={interval}
            options={intervalOptions}
            disabled={(value) => !intervalAllowed(value, range)}
            onChange={setChosen}
          />
        </div>
      </div>
      {state.status === "loading" && <div className="dash-chart-skeleton" />}
      {state.status === "error" && (
        <Failed error={state.error} onRetry={retry} />
      )}
      {state.status === "ready" &&
        (state.data.points.length === 0 ? (
          <p className="helper">Chưa có dữ liệu trong khoảng thời gian này.</p>
        ) : table ? (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <caption className="sr-only">{label}</caption>
              <thead>
                <tr>
                  <th scope="col">Mốc</th>
                  <th scope="col">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {state.data.points.map((point) => (
                  <tr key={point.bucket}>
                    <td>
                      {bucketLabel(point.bucket, state.data.interval, true)}
                    </td>
                    <td>{count(point.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <TrendChart
            points={state.data.points}
            interval={state.data.interval}
            label={label}
          />
        ))}
      {state.status === "ready" && state.data.points.length > 0 && (
        <Button variant="tertiary" onClick={() => setTable((value) => !value)}>
          {table ? "Xem dạng biểu đồ" : "Xem dạng bảng"}
        </Button>
      )}
    </Card>
  );
}

/** ADM-D3: the ten best dishes, restaurants or blogs. */
function Top({ service }: { service: DashboardService }) {
  const [type, setType] = useState<DashboardTopType>("dishes");
  const [state, retry] = useRemote(() => service.top(type, 10), type);
  return (
    <Card>
      <div className="dash-card-head">
        <div>
          <h2>Nổi bật</h2>
          <p className="helper">
            {type === "restaurants"
              ? "Xếp theo điểm đánh giá trung bình."
              : "Xếp theo lượt thích."}
          </p>
        </div>
        <Segmented
          label="Loại xếp hạng"
          value={type}
          options={topTabs}
          onChange={setType}
        />
      </div>
      {state.status === "loading" && <Skeleton rows={4} />}
      {state.status === "error" && (
        <Failed error={state.error} onRetry={retry} />
      )}
      {state.status === "ready" &&
        (state.data.items.length === 0 ? (
          <p className="helper">Chưa có dữ liệu để xếp hạng.</p>
        ) : (
          <ol className="dash-top">
            {state.data.items.map((item, index) => (
              <li key={item.id}>
                <span
                  className="dash-top-rank"
                  data-podium={index < 3 || undefined}
                >
                  {index + 1}
                </span>
                <span className="dash-top-name">
                  <strong>{item.name}</strong>
                  {item.subtitle && <small>{item.subtitle}</small>}
                </span>
                <span className="dash-top-score">
                  {topScore(state.data.type, item.score)}
                </span>
              </li>
            ))}
          </ol>
        ))}
    </Card>
  );
}

/** OPS-01 in short: what is waiting and the last failures, with the full list a click away. */
function OutboxPreview({
  service,
  outbox,
  base,
}: {
  service: DashboardService;
  outbox: DashboardSummaryDto["outbox"] | null;
  base: string;
}) {
  const [state, retry] = useRemote(
    () => service.outbox({ status: "dead", page: 1, pageSize: 5 }),
    "outbox-preview",
  );
  return (
    <Card>
      <div className="dash-card-head">
        <div>
          <h2>Đồng bộ gợi ý món</h2>
          <p className="helper">
            Sự kiện gửi sang dịch vụ gợi ý (cập nhật món, đánh giá món).
          </p>
        </div>
        <Link className="dash-link" href={`${base}/sync`}>
          Xem tất cả <ArrowRightIcon aria-hidden />
        </Link>
      </div>
      {outbox && (
        <div className="dash-outbox-status">
          <span data-tone="warning">
            <ArrowPathIcon aria-hidden />
            <strong>{count(outbox.pending)}</strong> đang chờ gửi
          </span>
          <span data-tone={outbox.dead > 0 ? "error" : "success"}>
            <ExclamationTriangleIcon aria-hidden />
            <strong>{count(outbox.dead)}</strong> gửi thất bại
          </span>
        </div>
      )}
      {state.status === "loading" && <Skeleton rows={2} />}
      {state.status === "error" && (
        <Failed error={state.error} onRetry={retry} />
      )}
      {state.status === "ready" &&
        (state.data.items.length === 0 ? (
          <p className="helper">Không có sự kiện nào gửi thất bại.</p>
        ) : (
          <ul className="dash-outbox-list">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <Badge tone="error">
                  {outboxStatusLabels[item.status] ?? item.status}
                </Badge>
                <span>
                  <strong>
                    {eventTypeLabels[item.eventType] ?? item.eventType}
                  </strong>
                  <small>
                    {item.aggregateKey} · {item.attemptCount} lần thử ·{" "}
                    {dateTime(item.createdAt)}
                  </small>
                  {item.lastError && <code>{item.lastError}</code>}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

/** F-63 View Dashboard (Admin): ADM-D1, ADM-D2, ADM-D3 and OPS-01 for one date range. */
export function AdminDashboardPage({
  service = dashboardService,
}: {
  service?: DashboardService;
}) {
  const { base } = useWorkspace();
  const [days, setDays] = useState<number>(30);
  const range = rangeOf(days);
  const [summary, retry] = useRemote(
    () => service.summary(range),
    `${range.from}:${range.to}`,
  );
  const moderation = "/moderation";

  return (
    <div className="stack dash-page">
      <PageHeading
        title="Tổng quan hệ thống"
        description="Người dùng, nhà hàng, nội dung, gợi ý món và việc kiểm duyệt của ANGI trong khoảng thời gian bạn chọn."
        action={
          <Segmented
            label="Khoảng thời gian"
            value={days}
            options={rangePresets.map((item) => ({
              value: item.days,
              label: item.label,
            }))}
            onChange={setDays}
          />
        }
      />
      <p className="helper dash-range" role="status">
        Số liệu từ {rangeLabel(range)} (giờ Việt Nam).
      </p>
      {summary.status === "loading" && (
        <div className="dash-kpis" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="dash-kpi is-loading" />
          ))}
        </div>
      )}
      {summary.status === "error" && (
        <Card title="Chưa tải được số liệu tổng quan">
          <Alert>{dashboardError(summary.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </Card>
      )}
      {summary.status === "ready" && (
        <Summary data={summary.data} moderation={moderation} />
      )}
      <Trend service={service} range={range} />
      {summary.status === "ready" && (
        <section className="dash-breakdowns" aria-label="Phân bổ">
          <Card title="Người dùng theo vai trò">
            <BarList
              label="Người dùng theo vai trò"
              rows={breakdownRows(summary.data.users.byRole, roleLabels)}
            />
          </Card>
          <Card title="Người dùng theo trạng thái">
            <BarList
              label="Người dùng theo trạng thái"
              rows={breakdownRows(
                summary.data.users.byStatus,
                userStatusLabels,
              )}
            />
          </Card>
          <Card title="Nhà hàng theo xác minh">
            <BarList
              label="Nhà hàng theo trạng thái xác minh"
              rows={breakdownRows(
                summary.data.restaurants.byVerificationStatus,
                verificationLabels,
              )}
            />
          </Card>
          <Card title="Nhà hàng theo kiểm duyệt">
            <BarList
              label="Nhà hàng theo trạng thái kiểm duyệt"
              rows={breakdownRows(
                summary.data.restaurants.byModerationStatus,
                moderationLabels,
              )}
            />
          </Card>
        </section>
      )}
      <div className="dash-columns">
        <Top service={service} />
        <OutboxPreview
          service={service}
          base={base}
          outbox={summary.status === "ready" ? summary.data.outbox : null}
        />
      </div>
    </div>
  );
}
